const apiUrl = import.meta.env.VITE_API_URL || "";

export const resolveMediaUrl = (url) => {
  if (!url) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${apiUrl}${url}`;
  }

  return `${apiUrl}/${url}`;
};
