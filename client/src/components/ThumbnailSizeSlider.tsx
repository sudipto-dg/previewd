import "./ThumbnailSizeSlider.css";

const MIN_SIZE = 100;
const MAX_SIZE = 1000;

interface ThumbnailSizeSliderProps {
  size: number;
  setSize: (size: number) => void;
}

function ThumbnailSizeSlider({ size, setSize }: ThumbnailSizeSliderProps) {
  return (
    <div className="thumbnail-size-slider">
      <label htmlFor="size-slider" className="slider-label">
        Thumbnail Size: {size}px
      </label>
      <input
        id="size-slider"
        type="range"
        min={MIN_SIZE}
        max={MAX_SIZE}
        value={size}
        onChange={(e) => setSize(parseInt(e.target.value, 10))}
        className="slider"
      />
    </div>
  );
}

export default ThumbnailSizeSlider;

