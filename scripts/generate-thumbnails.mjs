import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const projectRoot = process.cwd();

const galleryDir = path.join(projectRoot, "public", "images", "gallery");
const thumbsDir = path.join(galleryDir, "thumbs");
const optimizedDir = path.join(galleryDir, "optimized");
const imagesDir = path.join(projectRoot, "public", "images");

const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const forceRegenerate = process.argv.includes("--force");

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isOutputCurrent(inputPath, outputPath) {
  if (forceRegenerate || !(await fileExists(outputPath))) {
    return false;
  }

  const [inputStat, outputStat] = await Promise.all([
    fs.stat(inputPath),
    fs.stat(outputPath),
  ]);

  return outputStat.mtimeMs >= inputStat.mtimeMs;
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

    const thumbnailIsCurrent = await isOutputCurrent(inputPath, thumbnailPath);

    if (thumbnailIsCurrent) {
      console.log(`Skip: ${file} -> thumbs/${name}.webp is current`);
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

    const optimizedIsCurrent = await isOutputCurrent(inputPath, optimizedPath);

    if (optimizedIsCurrent) {
      console.log(`Skip: ${file} -> optimized/${name}.webp is current`);
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

  if (!(await fileExists(heroPoster))) {
    await sharp(heroSource)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(heroPoster);
    console.log("Created: images/hero.webp");
  }
}

Promise.all([generateThumbnails(), generatePageImages()]).catch((error) => {
  console.error(error);
  process.exit(1);
});
