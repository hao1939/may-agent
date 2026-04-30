export interface AppSettings {
  maxRetries: number;
  timeout: number;
  baseUrl: string;
}

export const settings: AppSettings = {
  maxRetries: 3,
  timeout: 5000,
  baseUrl: "https://api.example.com",
};
