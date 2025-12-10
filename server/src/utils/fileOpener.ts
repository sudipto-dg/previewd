import open from "open";
import fs from "node:fs";

export async function openFile(filePath: string): Promise<void> {
  // Verify file exists
  if (!fs.existsSync(filePath)) {
    throw new Error("File does not exist");
  }

  // Open with system default application
  await open(filePath);
}

