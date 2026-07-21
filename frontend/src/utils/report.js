import axios from "axios";

export const reportCategories = [
  { value: "spam", label: "Spam / promosi" },
  { value: "harassment", label: "Pelecehan / bullying" },
  { value: "hate_speech", label: "Ujaran kebencian" },
  { value: "violence", label: "Kekerasan / ancaman" },
  { value: "sexual_content", label: "Konten seksual" },
  { value: "misinformation", label: "Informasi salah" },
  { value: "spoiler", label: "Spoiler tanpa peringatan" },
  { value: "copyright", label: "Pelanggaran hak cipta" },
  { value: "other", label: "Lainnya" },
];

export const submitReport = async ({ targetType, targetId, category, reason }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("User belum login");
  }

  const response = await axios.post(
    `${import.meta.env.VITE_API_URL}/api/reports`,
    {
      target_type: targetType,
      target_id: targetId,
      category,
      reason,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response.data;
};
