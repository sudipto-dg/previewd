export interface FolderConfig {
    name: string;
    path: string;
    enabled: boolean;
}

export interface Config {
    folders: FolderConfig[];
    thumbnail: {
        maxWidth: number;
        maxHeight: number;
        quality: number;
        cache: {
            enabled: boolean;
            ttl: number;
            maxSize: number;
        };
    };
    video: {
        previewDuration: number;
        loop: boolean;
        thumbnailTime: number;
    };
    pagination: {
        defaultLimit: number;
        maxLimit: number;
    };
}

export interface FileItem {
    name: string;
    path: string;
    type: "file" | "directory";
    size?: number;
    modified?: string;
    extension?: string;
}

export interface BrowseResponse {
    items: FileItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ThumbnailResponse {
    thumbnail: string;
    path: string;
}

export interface BatchThumbnailResponse {
    thumbnails: Record<string, string>;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
}
