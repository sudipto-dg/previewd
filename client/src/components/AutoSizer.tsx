import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "react-use";

interface AutoSizerProps {
    children: (size: { width: number; height: number }) => React.ReactNode;
    className?: string;
}

function AutoSizer({ children, className }: AutoSizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const windowSize = useWindowSize();

    // biome-ignore lint/correctness/useExhaustiveDependencies: Refresh size on window resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setSize({
                    width: rect.width,
                    height: rect.height,
                });
            }
        };

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, [windowSize]);

    return (
        <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }}>
            {size.width > 0 && size.height > 0 && children(size)}
        </div>
    );
}

export default AutoSizer;
