function sanitizeFolderName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, "")
    .slice(0, 30);
}

function getPhoneLast4(phone: string) {
  const onlyNumbers = phone.replace(/\D/g, "");

  if (!onlyNumbers) {
    return "no-phone";
  }

  return onlyNumbers.slice(-4);
}

function getUploaderFolderName(name: string, phone: string) {
  const safeName = sanitizeFolderName(name) || "unknown";
  const phoneLast4 = getPhoneLast4(phone);

  return `${safeName}_${phoneLast4}`;
}
