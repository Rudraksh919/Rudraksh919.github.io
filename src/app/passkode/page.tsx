"use client";

import React, { useEffect, useState, useRef } from "react";
import styles from "./passkode.module.css";

// Simple client-side encrypted vault using Web Crypto API
// - PBKDF2 (SHA-256) to derive a 256-bit key (200k iterations)
// - AES-GCM for encryption
// Data stored in localStorage under key: `passkode_store`

function toBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = new Uint8Array(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: BufferSource) {
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  // Ensure salt is an ArrayBuffer
  const saltArr = salt instanceof Uint8Array ? salt : new Uint8Array(salt as ArrayBuffer);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltArr.buffer, iterations: 200000, hash: "SHA-256" } as Pbkdf2Params,
    pwKey,
    { name: "AES-GCM", length: 256 } as AesDerivedKeyParams,
    false,
    ["encrypt", "decrypt"]
  );
  return key;
}

async function encryptVault(key: CryptoKey, vault: any) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(vault));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: toBase64(iv), cipher: toBase64(ct) };
}

async function decryptVault(key: CryptoKey, ivB64: string, cipherB64: string) {
  const iv = fromBase64(ivB64);
  const ct = fromBase64(cipherB64);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  const decStr = new TextDecoder().decode(dec);
  return JSON.parse(decStr);
}

function loadStoreRaw() {
  try {
    const raw = localStorage.getItem("passkode_store");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export default function PasskodePage() {
  const [status, setStatus] = useState("locked"); // locked | unlocked | setup | recovery
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState("");
  const [email, setEmail] = useState("");
  const [recoveryHash, setRecoveryHash] = useState("");
  const [recoveryQuestion, setRecoveryQuestion] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [vault, setVault] = useState<any>({ entries: [] });
  const [mounted, setMounted] = useState(false);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [inputReveal, setInputReveal] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState<Record<string, boolean>>({});
  const [isAddingPassword, setIsAddingPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved email
    const savedEmail = localStorage.getItem("passkode_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setStatus("locked");
    } else {
      setStatus("setup");
    }
  }, []);

  // Helper: Create recovery hash from email + answer
  async function createRecoveryHash(email: string, answer: string) {
    const enc = new TextEncoder();
    const data = enc.encode(email.toLowerCase() + ":" + answer.toLowerCase());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return toBase64(hash);
  }

  // Handle initial vault setup
  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate inputs
    if (!email) return setError("Email is required");
    if (master.length < 6) return setError("Choose a stronger master password (min 6 chars)");
    if (!recoveryQuestion) return setError("Recovery question is required");
    if (!recoveryAnswer) return setError("Recovery answer is required");

    try {
      // Check if vault exists
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'get',
          data: { email }
        })
      });

      if (res.ok) {
        return setError("An account with this email already exists");
      }

      // Create new vault
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(master, salt);
      const empty = { 
        entries: [],
        recoveryQuestion,
        email 
      };
      const enc = await encryptVault(key, empty);
      const recoveryHash = await createRecoveryHash(email, recoveryAnswer);

      // Save to MongoDB
      const saveRes = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          data: {
            email,
            salt: toBase64(salt),
            iv: enc.iv,
            cipher: enc.cipher,
            recoveryHash
          }
        })
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save vault');
      }

      // Save email and vault locally
      localStorage.setItem("passkode_email", email);
      setVault(empty);
      setMaster("");
      setStatus("unlocked");
    } catch (err) {
      console.error('Setup error:', err);
      setError("Failed to create vault. Please try again.");
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (!email) return setError("Email is required");

    try {
      // Fetch vault from MongoDB
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get',
          data: { email }
        })
      });

      if (!res.ok) {
        return setError("No vault found for this email. Please create one.");
      }

      const store = await res.json();

      try {
        const salt = fromBase64(store.salt);
        const key = await deriveKey(master, salt);
        const data = await decryptVault(key, store.iv, store.cipher);
        
        // Save email locally
        localStorage.setItem("passkode_email", email);
        
        setVault(data);
        setMaster("");
        setStatus("unlocked");
      } catch (err) {
        setError("Incorrect password.");
      }
    } catch (err) {
      console.error('Unlock error:', err);
      setError("Failed to access vault. Please try again.");
    }
  }

  // Handle forgot password / recovery
  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) return setError("Email is required");
    if (!recoveryAnswer) return setError("Recovery answer is required");

    try {
      // Get recovery hash
      const recoveryHash = await createRecoveryHash(email, recoveryAnswer);

      // Verify recovery hash
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-recovery',
          data: { email, recoveryHash }
        })
      });

      if (!res.ok) {
        return setError("Invalid recovery answer");
      }

      // If verified, let user set new password
      setStatus("reset-password");
    } catch (err) {
      console.error('Recovery error:', err);
      setError("Recovery failed. Please try again.");
    }
  }

  async function saveVault(newVault: any) {
    const store = loadStoreRaw();
    if (!store) throw new Error("Missing store salt");
    const salt = fromBase64(store.salt);
    // Prefer cached master in session, otherwise prompt the user to enter it
    const pw = masterRef.current || promptPasswordForSave();
    if (!pw) throw new Error("No master password available to encrypt");
    const key = await deriveKey(pw, salt);
    // we do not keep master in state for security; to save we ask user to re-enter if necessary
    const enc = await encryptVault(key, newVault);
    const newStore = { ...store, iv: enc.iv, cipher: enc.cipher };
    localStorage.setItem("passkode_store", JSON.stringify(newStore));
  }

    // Helper: cache master password for session using a ref so it survives renders
    const masterRef = useRef<string | null>(null);

    function setUnlockedMasterForSession(pw: string) {
      masterRef.current = pw;
    }

    function promptPasswordForSave() {
      if (masterRef.current) return masterRef.current;
      const pw = prompt("Enter master password to save vault:");
      return pw || null;
    }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const username = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value.trim();
    if (!name || !password) return alert("Name and password required");
    const entry = { id: Date.now().toString(36), name, username, password, createdAt: Date.now() };
    const newVault = { ...vault, entries: [entry, ...(vault.entries || [])] };
    // save with a prompt for master (or cached)
    try {
      // if not cached, ask user to enter master to save
      if (!masterRef.current) {
        const pw = prompt("Enter master password to save this entry (will not be stored unless you choose to cache it):");
        if (!pw) return alert("Master password required to save");
        setUnlockedMasterForSession(pw);
      }
      await saveVault(newVault);
      setVault(newVault);
      form.reset();
    } catch (err) {
      alert("Failed to save vault: " + String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    const newVault = { ...vault, entries: (vault.entries || []).filter((x: any) => x.id !== id) };
    try {
      await saveVault(newVault);
      setVault(newVault);
    } catch (err) {
      alert("Failed to save vault: " + String(err));
    }
  }

  async function handleChangeMaster() {
    // Get the current master password from session or prompt
    let currentPassword = masterRef.current;
    if (!currentPassword) {
      currentPassword = prompt("Enter your current master password:");
      if (!currentPassword) return;
    }

    const newPassword = prompt("Enter your new master password (minimum 6 characters):");
    if (!newPassword) return;
    if (newPassword.length < 6) return alert("New password must be at least 6 characters");

    const confirmPassword = prompt("Confirm your new master password:");
    if (confirmPassword !== newPassword) return alert("New passwords don't match");

    const store = loadStoreRaw();
    if (!store) return alert("No vault found");

    try {
      // First verify current password by attempting to decrypt
      const currentSalt = fromBase64(store.salt);
      const currentKey = await deriveKey(currentPassword, currentSalt);
      const currentData = await decryptVault(currentKey, store.iv, store.cipher);

      // Generate new salt and key
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const newKey = await deriveKey(newPassword, newSalt);

      // Re-encrypt with new key
      const enc = await encryptVault(newKey, currentData);
      const newStore = { 
        salt: toBase64(newSalt), 
        iv: enc.iv, 
        cipher: enc.cipher, 
        createdAt: store.createdAt,
        updatedAt: Date.now()
      };

      localStorage.setItem("passkode_store", JSON.stringify(newStore));
      masterRef.current = newPassword; // Update cached master
      alert("Master password changed successfully");
    } catch (err) {
      alert("Failed to change master password. Please verify your current password is correct.");
      console.error("Password change failed:", err);
    }
  }

  function handleLogout() {
    setVault({ entries: [] });
    setStatus("locked");
    masterRef.current = null;
  }

  // password visibility & generator
  const [reveal, setReveal] = useState(false);
  function genPassword(len = 16) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_+={}[]<>?";
    let out = "";
    const vals = crypto.getRandomValues(new Uint32Array(len));
    for (let i = 0; i < len; i++) out += chars[vals[i] % chars.length];
    return out;
  }

  function strengthOf(pw: string) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (/[A-Z]/.test(pw)) score += 1;
    if (/[a-z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    return score / 5;
  }
  
  if (!mounted) return null;

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.title}>PassKode</div>
              <div className={styles.subtitle}>Password Vault</div>
            </div>
          </div>

          {/* Main Content */}
          <div className={styles.content}>
            {/* Authentication Forms */}
            {/* Setup Form */}
            {status === "setup" && (
              <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320, margin: "0 auto", width: "100%" }}>
                <label className={styles.label} htmlFor="email-setup">Email</label>
                <input
                  id="email-setup"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
                <label className={styles.label} htmlFor="master-setup">Master password</label>
                <input
                  id="master-setup"
                  type={inputReveal ? "text" : "password"}
                  placeholder="Enter master password"
                  value={master}
                  onChange={(e) => setMaster(e.target.value)}
                  className={styles.input}
                  required
                />
                <label className={styles.label} htmlFor="recovery-question">Recovery Question</label>
                <input
                  id="recovery-question"
                  type="text"
                  placeholder="e.g., What was your first pet's name?"
                  value={recoveryQuestion}
                  onChange={(e) => setRecoveryQuestion(e.target.value)}
                  className={styles.input}
                  required
                />
                <label className={styles.label} htmlFor="recovery-answer">Recovery Answer</label>
                <input
                  id="recovery-answer"
                  type="text"
                  placeholder="Enter your answer"
                  value={recoveryAnswer}
                  onChange={(e) => setRecoveryAnswer(e.target.value)}
                  className={styles.input}
                  required
                />
                <div className={styles.formRow}>
                  <div className={styles.controls}>
                    <button className={styles.btnPrimary} type="submit">Create Vault</button>
                    <button type="button" className={styles.btnSecondary} onClick={() => setInputReveal(r => !r)}>
                      {inputReveal ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>
              </form>
            )}
            
            {/* Recovery Form */}
            {status === "recovery" && (
              <form onSubmit={handleRecovery} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320, margin: "0 auto", width: "100%" }}>
                <label className={styles.label} htmlFor="email-recovery">Email</label>
                <input
                  id="email-recovery"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
                <label className={styles.label} htmlFor="recovery-answer">Recovery Answer</label>
                <input
                  id="recovery-answer"
                  type="text"
                  placeholder="Enter your answer"
                  value={recoveryAnswer}
                  onChange={(e) => setRecoveryAnswer(e.target.value)}
                  className={styles.input}
                  required
                />
                <div className={styles.formRow}>
                  <div className={styles.controls}>
                    <button className={styles.btnPrimary} type="submit">Recover Access</button>
                    <button type="button" className={styles.btnSecondary} onClick={() => setStatus("locked")}>
                      Back to Login
                    </button>
                  </div>
                </div>
                <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>
              </form>
            )}

            {/* Login Form */}
            {status === "locked" && (
              <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320, margin: "0 auto", width: "100%" }}>
                <label className={styles.label} htmlFor="email-unlock">Email</label>
                <input
                  id="email-unlock"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
                <label className={styles.label} htmlFor="master-unlock">Master password</label>
                <input
                  id="master-unlock"
                  type={reveal ? "text" : "password"}
                  placeholder="Enter master password"
                  value={master}
                  onChange={(e) => setMaster(e.target.value)}
                  className={styles.input}
                />
                <div className={styles.formRow}>
                  <div className={styles.controls}>
                    <button className={styles.btnPrimary} type="submit">Unlock</button>
                  </div>
                </div>
                <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>
              </form>
            )}

            {/* Vault Management UI */}
            {status === "unlocked" && (
              <div className={styles.vault}>
                {/* Toolbar */}
                <div className={styles.toolbar}>
                  <div className={styles.toolbarLeft}>
                    <button
                      className={styles.btnPrimary}
                      onClick={() => setShowAddPopup(true)}
                    >
                      Add Password
                    </button>
                    <button
                      className={styles.btnSecondary}
                      onClick={handleChangeMaster}
                    >
                      Change Master
                    </button>
                  </div>
                  <div className={styles.toolbarRight}>
                    <button className={styles.btnSecondary} onClick={handleLogout}>
                      🔒 Lock
                    </button>
                  </div>
                </div>

                {/* Add Password Popup */}
                {showAddPopup && (
                  <div className={styles.popup}>
                    <div className={styles.popupContent}>
                      <div className={styles.popupHeader}>
                        <h3>Add New Password</h3>
                        <button 
                          className={styles.btnIcon} 
                          onClick={() => {
                            setShowAddPopup(false);
                            setInputReveal(false);
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <form onSubmit={(e) => { 
                        handleAddEntry(e); 
                        setShowAddPopup(false);
                        setInputReveal(false);
                      }}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Website / Name</label>
                          <input 
                            className={styles.input} 
                            name="name" 
                            placeholder="example.com"
                            required
                            autoFocus
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Username / Email</label>
                          <input 
                            className={styles.input} 
                            name="username" 
                            placeholder="user@example.com"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Password</label>
                          <div className={styles.passwordInput}>
                            <input 
                              className={styles.input}
                              name="password"
                              type={inputReveal ? "text" : "password"}
                              placeholder="Enter password"
                              required
                            />
                            <button 
                              type="button"
                              className={styles.btnIcon}
                              onClick={(e) => {
                                const form = e.currentTarget.closest('form');
                                if (form) {
                                  const field = form.querySelector('input[name="password"]') as HTMLInputElement;
                                  if (field) field.value = genPassword(16);
                                }
                              }}
                              title="Generate password"
                            >
                              🎲
                            </button>
                            <button 
                              type="button"
                              className={styles.btnIcon}
                              onClick={() => setInputReveal(r => !r)}
                              title={inputReveal ? "Hide password" : "Show password"}
                            >
                              {inputReveal ? "👁" : "👁‍🗨"}
                            </button>
                          </div>
                        </div>
                        <div className={styles.popupFooter}>
                          <button 
                            type="button" 
                            className={styles.btnSecondary} 
                            onClick={() => {
                              setShowAddPopup(false);
                              setInputReveal(false);
                            }}
                          >
                            Cancel
                          </button>
                          <button type="submit" className={styles.btnPrimary}>
                            Save
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                <hr style={{ margin: "12px 0", borderColor: "rgba(255,255,255,0.03)" }} />

                {/* Password List */}
                <div className={styles.passwordList}>
                  {(vault.entries || []).length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>🔑</div>
                      <div className={styles.emptyTitle}>No passwords yet</div>
                      <div className={styles.emptyText}>Click "Add Password" to store your first password</div>
                    </div>
                  ) : (
                    <div className={styles.entries}>
                      {(vault.entries || []).map((e: any) => (
                        <div key={e.id} className={styles.entry}>
                          <div className={styles.entryIcon}>
                            {e.name.charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.entryDetails}>
                            <div className={styles.entryName}>{e.name}</div>
                            {e.username && (
                              <div className={styles.entryUsername}>{e.username}</div>
                            )}
                            <div className={styles.entryPassword} style={{ display: passwordReveal[e.id] ? 'block' : 'none' }}>
                              {e.password}
                            </div>
                          </div>
                          <div className={styles.entryActions}>
                            <button
                              className={styles.btnIcon}
                              onClick={() => setPasswordReveal(prev => ({ ...prev, [e.id]: !prev[e.id] }))}
                              title={passwordReveal[e.id] ? "Hide password" : "Show password"}
                            >
                              {passwordReveal[e.id] ? "👁" : "👁‍🗨"}
                            </button>
                            <button
                              className={styles.btnIcon}
                              onClick={() => {
                                navigator.clipboard?.writeText(e.password).then(() => alert("Password copied"));
                              }}
                              title="Copy password"
                            >
                              📋
                            </button>
                            <button 
                              className={styles.btnIcon} 
                              onClick={() => handleDelete(e.id)}
                              title="Delete entry"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
