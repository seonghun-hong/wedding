import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const projectRoot = process.cwd();

const galleryDir = path.join(projectRoot, "public", "images", "gallery");
const thumbsDir = path.join(galleryDir, "thumbs");

const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateThumbnails() {
  await fs.mkdir(thumbsDir, { recursive: true });

  const files = await fs.readdir(galleryDir);

  const imageFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      return false;
    }

    return !file.startsWith(".");
  });

  if (imageFiles.length === 0) {
    console.log("No gallery images found.");
    return;
  }

  for (const file of imageFiles) {
    const ext = path.extname(file);
    const name = path.basename(file, ext);

    const inputPath = path.join(galleryDir, file);
    const outputPath = path.join(thumbsDir, `${name}.webp`);

    const alreadyExists = await fileExists(outputPath);

    if (alreadyExists) {
      console.log(`Skip: ${file} -> thumbs/${name}.webp already exists`);
      continue;
    }

    await sharp(inputPath)
      .rotate()
      .resize({
        width: 500,
        height: 500,
        fit: "cover",
        position: "center",
      })
      .webp({
        quality: 72,
      })
      .toFile(outputPath);

    console.log(`Created: ${file} -> thumbs/${name}.webp`);
  }
}

generateThumbnails().catch((error) => {
  console.error(error);
  process.exit(1);
});