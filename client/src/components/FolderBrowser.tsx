import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useThumbnailSize } from "../hooks/useThumbnailSize.js";
import { apiService } from "../services/api.js";
import type { FileItem } from "../types/index.js";
import { openFile } from "../utils/fileOpener.js";
import AutoSizer from "./AutoSizer.tsx";
import ThumbnailGrid from "./ThumbnailGrid.tsx";
import ThumbnailSizeSlider from "./ThumbnailSizeSlider.tsx";
import "./FolderBrowser.css";

function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

function isPathWithinRoot(candidatePath: string, rootPath: string): boolean {
    const normalizedCandidate = normalizePath(candidatePath);
    const normalizedRoot = normalizePath(rootPath);

    if (!normalizedCandidate || !normalizedRoot) {
        return false;
    }

    return (
        normalizedCandidate === normalizedRoot ||
        normalizedCandidate.startsWith(`${normalizedRoot}/`)
    );
}

function getBestMatchingRoot(candidatePath: string, rootPaths: string[]): string | null {
    const matches = rootPaths.filter((rootPath) => isPathWithinRoot(candidatePath, rootPath));
    if (matches.length === 0) {
        return null;
    }

    return matches.sort((a, b) => normalizePath(b).length - normalizePath(a).length)[0];
}

function FolderBrowser() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialPathRef = useRef(searchParams.get("path") || "");
    const [folders, setFolders] = useState<Array<{ name: string; path: string; enabled: boolean }>>(
        []
    );
    const [selectedRootPath, setSelectedRootPath] = useState("");
    const [currentPath, setCurrentPath] = useState(() => initialPathRef.current);
    const currentPathRef = useRef(currentPath);
    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"name" | "size" | "date" | "type">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const browseRequestIdRef = useRef(0);

    const { size: thumbnailSize, setSize: setThumbnailSize } = useThumbnailSize();

    useEffect(() => {
        currentPathRef.current = currentPath;
    }, [currentPath]);

    // Load folders on mount
    useEffect(() => {
        apiService
            .getFolders()
            .then((data) => {
                setFolders(data.folders);
                if (data.folders.length === 0) return;

                const availableRootPaths = data.folders.map((folder) => folder.path);
                const matchedRoot =
                    getBestMatchingRoot(initialPathRef.current, availableRootPaths) ||
                    getBestMatchingRoot(currentPathRef.current, availableRootPaths) ||
                    availableRootPaths[0];

                setSelectedRootPath(matchedRoot);
                setCurrentPath((prevPath) =>
                    isPathWithinRoot(prevPath, matchedRoot)
                        ? prevPath
                        : initialPathRef.current || matchedRoot
                );
            })
            .catch((err) => {
                console.error("Failed to load folders:", err);
                setError("Failed to load folders");
            });
    }, []);

    // Keep selected root aligned with the current path when navigating.
    useEffect(() => {
        if (!currentPath || folders.length === 0) return;

        const availableRootPaths = folders.map((folder) => folder.path);
        const matchedRootPath = getBestMatchingRoot(currentPath, availableRootPaths);
        if (!matchedRootPath) return;

        const matchedRoot = folders.find(
            (folder) => normalizePath(folder.path) === normalizePath(matchedRootPath)
        );
        if (matchedRoot && normalizePath(matchedRoot.path) !== normalizePath(selectedRootPath)) {
            setSelectedRootPath(matchedRoot.path);
        }
    }, [currentPath, folders, selectedRootPath]);

    // Update URL when path changes
    useEffect(() => {
        if (currentPath) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set("path", currentPath);
            // Remove pagination params
            newParams.delete("page");
            newParams.delete("limit");
            setSearchParams(newParams, { replace: true });
        }
    }, [currentPath, searchParams, setSearchParams]);

    // Load items when path or sorting changes
    useEffect(() => {
        if (!currentPath) return;

        const requestId = ++browseRequestIdRef.current;
        setLoading(true);
        setError(null);

        apiService
            .browse({
                path: currentPath,
                limit: 10000, // Use a very high limit to get all items
                sortBy,
                sortOrder,
            })
            .then((data) => {
                if (browseRequestIdRef.current !== requestId) return;
                setItems(data.items);
            })
            .catch((err) => {
                if (browseRequestIdRef.current !== requestId) return;
                console.error("Failed to browse directory:", err);
                setError("Failed to load directory contents");
            })
            .finally(() => {
                if (browseRequestIdRef.current !== requestId) return;
                setLoading(false);
            });
    }, [currentPath, sortBy, sortOrder]);

    // No thumbnails - files will be shown directly

    const handleItemClick = (item: FileItem) => {
        if (item.type === "directory") {
            setCurrentPath(item.path);
        } else {
            // For files, open with system default application
            openFile(item.path).catch((err) => {
                console.error("Failed to open file:", err);
            });
        }
    };

    const handleBreadcrumbClick = (path: string) => {
        setCurrentPath(path);
    };

    const breadcrumbs = useMemo(() => {
        if (!currentPath || !selectedRootPath) return [];

        const normalizedCurrent = normalizePath(currentPath);
        const normalizedRoot = normalizePath(selectedRootPath);

        if (!normalizedCurrent || !normalizedRoot || normalizedCurrent === normalizedRoot) {
            return [];
        }

        if (!isPathWithinRoot(currentPath, selectedRootPath)) {
            return [];
        }

        const relativePath = normalizedCurrent.slice(normalizedRoot.length).replace(/^\/+/, "");
        const parts = relativePath ? relativePath.split("/") : [];
        const crumbs: Array<{ name: string; path: string }> = [];
        const separator = selectedRootPath.includes("\\") ? "\\" : "/";
        const rootWithoutTrailingSeparator = selectedRootPath.replace(/[\\/]+$/, "");

        parts.forEach((part, index) => {
            const pathParts = parts.slice(0, index + 1);
            crumbs.push({
                name: part,
                path: [rootWithoutTrailingSeparator, ...pathParts].join(separator),
            });
        });

        return crumbs;
    }, [currentPath, selectedRootPath]);

    const selectedRoot =
        folders.find((folder) => normalizePath(folder.path) === normalizePath(selectedRootPath)) ||
        null;

    const handleRootChange = (rootPath: string) => {
        setSelectedRootPath(rootPath);
        setCurrentPath(rootPath);
    };

    if (error && !currentPath) {
        return (
            <div className="folder-browser">
                <div className="error-message">{error}</div>
            </div>
        );
    }

    return (
        <div className="folder-browser">
            <header className="folder-browser-header">
                <h1>File Browser</h1>
                <div className="header-controls">
                    <label className="root-folder-select-label" htmlFor="root-folder-select">
                        Root folder
                    </label>
                    <select
                        id="root-folder-select"
                        value={selectedRootPath}
                        onChange={(e) => handleRootChange(e.target.value)}
                        className="root-folder-select"
                        disabled={folders.length === 0}
                    >
                        {folders.length === 0 ? (
                            <option value="">No folders configured</option>
                        ) : (
                            folders.map((folder) => (
                                <option key={folder.path} value={folder.path}>
                                    {folder.name}
                                </option>
                            ))
                        )}
                    </select>
                    <ThumbnailSizeSlider size={thumbnailSize} setSize={setThumbnailSize} />
                    <select
                        value={sortBy}
                        onChange={(e) =>
                            setSortBy(e.target.value as "name" | "size" | "date" | "type")
                        }
                        className="sort-select"
                    >
                        <option value="name">Sort by Name</option>
                        <option value="size">Sort by Size</option>
                        <option value="date">Sort by Date</option>
                        <option value="type">Sort by Type</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="sort-order-button"
                    >
                        {sortOrder === "asc" ? "↑" : "↓"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            localStorage.removeItem("token");
                            window.location.href = "/login";
                        }}
                        className="logout-button"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <div className="breadcrumbs">
                {selectedRoot && (
                    <button
                        type="button"
                        onClick={() => handleBreadcrumbClick(selectedRoot.path)}
                        className="breadcrumb-item"
                    >
                        {selectedRoot.name}
                    </button>
                )}
                {breadcrumbs.map((crumb) => (
                    <span key={crumb.path}>
                        <span className="breadcrumb-separator">/</span>
                        <button
                            type="button"
                            onClick={() => handleBreadcrumbClick(crumb.path)}
                            className="breadcrumb-item"
                        >
                            {crumb.name}
                        </button>
                    </span>
                ))}
            </div>

            {loading ? (
                <div className="loading">Loading...</div>
            ) : error ? (
                <div className="error-message">{error}</div>
            ) : (
                <>
                    <div className="thumbnail-container">
                        <AutoSizer>
                            {({ width, height }) => (
                                <ThumbnailGrid
                                    items={items}
                                    thumbnails={{}}
                                    size={thumbnailSize}
                                    width={width}
                                    height={height}
                                    onItemClick={handleItemClick}
                                />
                            )}
                        </AutoSizer>
                    </div>
                </>
            )}
        </div>
    );
}

export default FolderBrowser;
