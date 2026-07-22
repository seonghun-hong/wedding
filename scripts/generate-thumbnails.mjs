import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const projectRoot = process.cwd();

const galleryDir = path.join(projectRoot, "public", "images", "gallery");
const thumbsDir = path.join(galleryDir, "thumbs");
const optimizedDir = path.join(galleryDir, "optimized");

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
  await fs.mkdir(optimizedDir, { recursive: true });

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
    const thumbnailPath = path.join(thumbsDir, `${name}.webp`);
    const optimizedPath = path.join(optimizedDir, `${name}.webp`);

    const thumbnailExists = await fileExists(thumbnailPath);

    if (thumbnailExists) {
      console.log(`Skip: ${file} -> thumbs/${name}.webp already exists`);
    } else {
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
        .toFile(thumbnailPath);

      console.log(`Created: ${file} -> thumbs/${name}.webp`);
    }

    const optimizedExists = await fileExists(optimizedPath);

    if (optimizedExists) {
      console.log(`Skip: ${file} -> optimized/${name}.webp already exists`);
      continue;
    }

    await sharp(inputPath)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 78,
      })
      .toFile(optimizedPath);

    console.log(`Created: ${file} -> optimized/${name}.webp`);
  }
}

generateThumbnails().catch((error) => {
  console.error(error);
  process.exit(1);
});
