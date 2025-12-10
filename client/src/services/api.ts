import axios from "axios";
import type {
  BrowseResponse,
  ThumbnailResponse,
  BatchThumbnailResponse,
  LoginRequest,
  LoginResponse,
  Config,
} from "../types/index.js";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  paramsSerializer: {
    indexes: null, // Use paths=value1&paths=value2 instead of paths[]=value1&paths[]=value2
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const apiService = {
  async getFolders(): Promise<{ folders: Array<{ name: string; path: string; enabled: boolean }> }> {
    const response = await api.get("/folders");
    return response.data;
  },

  async browse(params: {
    path: string;
    page?: number;
    limit?: number;
    sortBy?: "name" | "size" | "date" | "type";
    sortOrder?: "asc" | "desc";
  }): Promise<BrowseResponse> {
    const response = await api.get("/browse", { params });
    return response.data;
  },

  async getThumbnail(
    path: string,
    width?: number,
    height?: number,
  ): Promise<ThumbnailResponse> {
    const response = await api.get("/thumbnail", {
      params: { path, width, height },
    });
    return response.data;
  },

  async getBatchThumbnails(
    paths: string[],
    width?: number,
    height?: number,
  ): Promise<BatchThumbnailResponse> {
    const response = await api.get("/thumbnails/batch", {
      params: { paths, width, height },
    });
    return response.data;
  },

  async getVideoPreview(
    path: string,
    duration?: number,
  ): Promise<{ preview: string; path: string }> {
    const response = await api.get("/video-preview", {
      params: { path, duration },
    });
    return response.data;
  },

  async openFile(path: string): Promise<{ success: boolean }> {
    const response = await api.post("/open-file", { path });
    return response.data;
  },

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post("/login", credentials);
    return response.data;
  },

  async getConfig(): Promise<Config> {
    const response = await api.get("/config");
    return response.data;
  },

  async updateConfig(config: Config): Promise<{ success: boolean }> {
    const response = await api.post("/config", config);
    return response.data;
  },
};

export default api;

