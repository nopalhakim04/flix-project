export const fileToDataUrl = (file) => {
  if (!file?.buffer || !file?.mimetype) {
    return null;
  }

  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};
