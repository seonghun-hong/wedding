import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const projectRoot = process.cwd();

const galleryDir = path.join(projectRoot, "public", "images", "gallery");
const thumbsDir = path.join(galleryDir, "thumbs");
const optimizedDir = path.join(galleryDir, "optimized");
const imagesDir = path.join(projectRoot, "public", "images");

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

async function generatePageImages() {
  const heroSource = path.join(imagesDir, "hero.jpg");
  const heroPoster = path.join(imagesDir, "hero.webp");
  const shareImage = path.join(imagesDir, "og-share.jpg");

  if (!(await fileExists(heroPoster))) {
    await sharp(heroSource)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(heroPoster);
    console.log("Created: images/hero.webp");
  }

  if (!(await fileExists(shareImage))) {
    await sharp(heroSource)
      .rotate()
      .resize({ width: 1200, height: 630, fit: "cover", position: "south" })
      .jpeg({ quality: 82, progressive: true })
      .toFile(shareImage);
    console.log("Created: images/og-share.jpg");
  }
}

Promise.all([generateThumbnails(), generatePageImages()]).catch((error) => {
  console.error(error);
  process.exit(1);
});
