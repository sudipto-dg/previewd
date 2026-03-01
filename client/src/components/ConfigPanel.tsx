import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../services/api.js";
import type { Config } from "../types/index.js";
import "./ConfigPanel.css";

function ConfigPanel() {
    const navigate = useNavigate();
    const [config, setConfig] = useState<Config | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiService
            .getConfig()
            .then((data) => {
                setConfig(data);
            })
            .catch((err) => {
                console.error("Failed to load config:", err);
                setError("Failed to load configuration");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        if (!config) return;

        setSaving(true);
        setError(null);

        try {
            await apiService.updateConfig(config);
            navigate("/");
        } catch (err) {
            console.error("Failed to save config:", err);
            setError("Failed to save configuration");
        } finally {
            setSaving(false);
        }
    };

    const handleAddFolder = () => {
        if (!config) return;

        setConfig({
            ...config,
            folders: [...config.folders, { name: "", path: "", enabled: true }],
        });
    };

    const handleRemoveFolder = (index: number) => {
        if (!config) return;

        setConfig({
            ...config,
            folders: config.folders.filter((_, i) => i !== index),
        });
    };

    const handleFolderChange = (
        index: number,
        field: "name" | "path" | "enabled",
        value: string | boolean
    ) => {
        if (!config) return;

        const newFolders = [...config.folders];
        newFolders[index] = { ...newFolders[index], [field]: value };
        setConfig({ ...config, folders: newFolders });
    };

    if (loading) {
        return <div className="config-panel">Loading...</div>;
    }

    if (!config) {
        return <div className="config-panel">Failed to load configuration</div>;
    }

    return (
        <div className="config-panel">
            <header className="config-header">
                <h1>Configuration</h1>
                <div className="config-actions">
                    <button type="button" onClick={() => navigate("/")} className="cancel-button">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="save-button"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </header>

            {error && <div className="error-message">{error}</div>}

            <div className="config-content">
                <section className="config-section">
                    <h2>Folders</h2>
                    <div className="folders-list">
                        {config.folders.map((folder, index) => (
                            <div key={index.toString()} className="folder-item">
                                <input
                                    type="text"
                                    placeholder="Folder Name"
                                    value={folder.name}
                                    onChange={(e) =>
                                        handleFolderChange(index, "name", e.target.value)
                                    }
                                    className="folder-input"
                                />
                                <input
                                    type="text"
                                    placeholder="Folder Path"
                                    value={folder.path}
                                    onChange={(e) =>
                                        handleFolderChange(index, "path", e.target.value)
                                    }
                                    className="folder-input folder-path"
                                />
                                <label className="folder-enabled">
                                    <input
                                        type="checkbox"
                                        checked={folder.enabled}
                                        onChange={(e) =>
                                            handleFolderChange(index, "enabled", e.target.checked)
                                        }
                                    />
                                    Enabled
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFolder(index)}
                                    className="remove-button"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddFolder} className="add-button">
                        Add Folder
                    </button>
                </section>

                <section className="config-section">
                    <h2>Thumbnail Settings</h2>
                    <div className="config-field">
                        <label htmlFor="thumbnail-max-width">Max Width</label>
                        <input
                            id="thumbnail-max-width"
                            type="number"
                            value={config.thumbnail.maxWidth}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    thumbnail: {
                                        ...config.thumbnail,
                                        maxWidth: Number.parseInt(e.target.value, 10),
                                    },
                                })
                            }
                        />
                    </div>
                    <div className="config-field">
                        <label htmlFor="thumbnail-max-height">Max Height</label>
                        <input
                            id="thumbnail-max-height"
                            type="number"
                            value={config.thumbnail.maxHeight}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    thumbnail: {
                                        ...config.thumbnail,
                                        maxHeight: Number.parseInt(e.target.value, 10),
                                    },
                                })
                            }
                        />
                    </div>
                    <div className="config-field">
                        <label htmlFor="thumbnail-quality">Quality</label>
                        <input
                            id="thumbnail-quality"
                            type="number"
                            min="1"
                            max="100"
                            value={config.thumbnail.quality}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    thumbnail: {
                                        ...config.thumbnail,
                                        quality: Number.parseInt(e.target.value, 10),
                                    },
                                })
                            }
                        />
                    </div>
                </section>

                <section className="config-section">
                    <h2>Video Settings</h2>
                    <div className="config-field">
                        <label htmlFor="video-preview-duration">Preview Duration (seconds)</label>
                        <input
                            id="video-preview-duration"
                            type="number"
                            value={config.video.previewDuration}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    video: {
                                        ...config.video,
                                        previewDuration: Number.parseInt(e.target.value, 10),
                                    },
                                })
                            }
                        />
                    </div>
                    <div className="config-field">
                        <label htmlFor="video-thumbnail-time">Thumbnail Time (seconds)</label>
                        <input
                            id="video-thumbnail-time"
                            type="number"
                            value={config.video.thumbnailTime}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    video: {
                                        ...config.video,
                                        thumbnailTime: Number.parseInt(e.target.value, 10),
                                    },
                                })
                            }
                        />
                    </div>
                </section>
            </div>
        </div>
    );
}

export default ConfigPanel;
