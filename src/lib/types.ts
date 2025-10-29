export interface VaultData {
  email: string;
  salt: string;
  iv: string;
  cipher: string;
  recoveryHash: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Vault {
  entries: Array<{
    id: string;
    name: string;
    username?: string;
    password: string;
    createdAt: number;
  }>;
  recoveryQuestion: string;
  email: string;
}