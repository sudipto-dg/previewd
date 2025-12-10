import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { apiService } from "../services/api.js";
import { useThumbnailSize } from "../hooks/useThumbnailSize.js";
import { openFile } from "../utils/fileOpener.js";
import ThumbnailGrid from "./ThumbnailGrid.tsx";
import AutoSizer from "./AutoSizer.tsx";
import ThumbnailSizeSlider from "./ThumbnailSizeSlider.tsx";
import type { FileItem } from "../types/index.js";
import "./FolderBrowser.css";

function FolderBrowser() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; enabled: boolean }>>([]);
  const [currentPath, setCurrentPath] = useState(() => {
    return searchParams.get("path") || "";
  });
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "size" | "date" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { size: thumbnailSize, setSize: setThumbnailSize } = useThumbnailSize();

  // Load folders on mount
  useEffect(() => {
    apiService
      .getFolders()
      .then((data) => {
        setFolders(data.folders);
        if (data.folders.length > 0 && !currentPath) {
          setCurrentPath(data.folders[0].path);
        }
      })
      .catch((err) => {
        console.error("Failed to load folders:", err);
        setError("Failed to load folders");
      });
  }, []);

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
        setItems(data.items);
      })
      .catch((err) => {
        console.error("Failed to browse directory:", err);
        setError("Failed to load directory contents");
      })
      .finally(() => {
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
    if (!currentPath) return [];
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    const crumbs: Array<{ name: string; path: string }> = [];
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      crumbs.push({ name: part, path: current });
    }

    return crumbs;
  }, [currentPath]);

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
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="sort-order-button"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
          <button
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
        {folders.length > 0 && (
          <button
            onClick={() => handleBreadcrumbClick(folders[0].path)}
            className="breadcrumb-item"
          >
            {folders[0].name}
          </button>
        )}
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.path}>
            <span className="breadcrumb-separator">/</span>
            <button
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

