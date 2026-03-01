import { useMemo } from "react";
import type { CellComponentProps } from "react-window";
import { Grid } from "react-window";
import type { FileItem } from "../types/index.js";
import { buildVideoFileUrl, isVideoFile } from "../utils/fileOpener.js";
import ThumbnailItem from "./ThumbnailItem.tsx";
import "./ThumbnailGrid.css";

interface ThumbnailGridProps {
    items: FileItem[];
    thumbnails: Record<string, string>;
    size: number;
    width: number;
    height: number;
    onItemClick?: (item: FileItem) => void;
}

async function copyTextToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.style.left = "-9999px";

    document.body.appendChild(textArea);

    const selection = document.getSelection();
    const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    let copied = false;

    try {
        copied = document.execCommand("copy");
    } finally {
        document.body.removeChild(textArea);

        if (selectedRange && selection) {
            selection.removeAllRanges();
            selection.addRange(selectedRange);
        }
    }

    if (!copied) {
        throw new Error("Clipboard copy is not supported in this browser context");
    }
}

function ThumbnailGrid({
    items,
    thumbnails,
    size,
    width,
    height,
    onItemClick,
}: ThumbnailGridProps) {
    // Use smaller gap on mobile to maximize thumbnail space
    const gap = width < 768 ? 2 : 8;

    const itemWidth = useMemo(() => size + gap * 2, [size, gap]);
    const itemHeight = useMemo(() => size + 32, [size]); // 32px for label

    const columnCount = useMemo(() => {
        return Math.max(1, Math.floor(width / itemWidth));
    }, [width, itemWidth]);

    const rowCount = useMemo(() => {
        return Math.ceil(items.length / columnCount);
    }, [items.length, columnCount]);

    const columnWidth = useMemo(() => {
        return width / columnCount;
    }, [width, columnCount]);

    const Cell = ({ ariaAttributes, columnIndex, rowIndex, style }: CellComponentProps) => {
        const index = rowIndex * columnCount + columnIndex;
        if (index >= items.length) {
            return <div style={style} />;
        }

        const item = items[index];
        const thumbnail = thumbnails[item.path];
        const showCopyButton = item.type === "file" && isVideoFile(item.path);

        const handleCopyLink = async (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            try {
                const url = buildVideoFileUrl(item.path);
                await copyTextToClipboard(url);
            } catch (error) {
                console.error("Failed to copy video link:", error);
            }
        };

        return (
            <div {...ariaAttributes} style={style} className="grid-cell">
                {showCopyButton && (
                    <button
                        type="button"
                        className="thumbnail-copy-link-button"
                        onClick={handleCopyLink}
                        aria-label="Copy video link"
                        title="Copy video link"
                    >
                        Copy link
                    </button>
                )}
                <ThumbnailItem
                    item={item}
                    thumbnail={thumbnail}
                    size={size}
                    onClick={() => onItemClick?.(item)}
                />
            </div>
        );
    };

    if (items.length === 0) {
        return (
            <div className="thumbnail-grid-empty">
                <p>No items to display</p>
            </div>
        );
    }

    return (
        <Grid
            key={`grid-${size}-${width}-${height}`}
            className="thumbnail-grid"
            cellComponent={Cell}
            cellProps={{}}
            columnCount={columnCount}
            columnWidth={columnWidth}
            rowCount={rowCount}
            rowHeight={itemHeight}
            style={{ height, width }}
        />
    );
}

export default ThumbnailGrid;
