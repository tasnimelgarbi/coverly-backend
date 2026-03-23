import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function uploadToImgBB(fileBuffer, fileName = "image") {
  if (!process.env.IMGBB_API_KEY) {
    throw new Error("IMGBB_API_KEY is missing in .env");
  }

  const base64Image = fileBuffer.toString("base64");

  const formData = new URLSearchParams();
  formData.append("image", base64Image);
  formData.append("name", fileName);

  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    formData.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 30000,
    }
  );

  const imageUrl =
    response?.data?.data?.url ||
    response?.data?.data?.display_url ||
    null;

  if (!imageUrl) {
    throw new Error("ImgBB upload failed: no URL returned");
  }

  return imageUrl;
}