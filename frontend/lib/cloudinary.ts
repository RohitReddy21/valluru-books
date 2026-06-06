
// Helper to generate a timestamp and signature for Cloudinary uploads
// We'll add a backend endpoint to generate secure signatures later for production,
// but for now we can use an unsigned preset OR a signature endpoint.
// Let's first add an unsigned upload preset on Cloudinary (recommended for simple use case)

export async function uploadToCloudinary(
  file: File,
  folder: string,
  preset?: string
) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new Error("Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  
  // Use unsigned preset if provided (create this in Cloudinary settings first!)
  if (preset) {
    formData.append("upload_preset", preset);
  }

  // Determine resource type based on file
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const resourceType = isPdf ? "raw" : "auto";
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Cloudinary upload failed");
  }

  return response.json();
}
