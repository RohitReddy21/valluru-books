const { ObjectId } = require("mongodb");

function registerImageRoutes(
  app,
  { verifyAdmin, upload, requireMongo, requireSupabase, uploadToSupabase, getDb, cleanupUploadedFile }
) {
  app.post(
    "/api/admin/images/upload",
    verifyAdmin,
    upload.single("image"),
    async (request, response, next) => {
      try {
        if (!requireMongo(response)) {
          return;
        }

        if (!requireSupabase(response)) {
          return;
        }

        const file = request.file;
        const { movement, booklet, imageType, safeZones } = request.body;

        if (!file) {
          response.status(400).json({ error: "Image file is required." });
          return;
        }

        if (!movement) {
          response.status(400).json({ error: "Movement is required." });
          return;
        }

        const uploaded = await uploadToSupabase(file, {
          bucket: "books",
          folder: `images/${movement}${booklet ? `/${booklet}` : ""}`
        });

        const db = await getDb();
        const imageDoc = {
          title: request.body.title || file.originalname,
          movement: Number(movement),
          booklet: booklet ? Number(booklet) : null,
          imageType: imageType || "cover",
          originalImage: uploaded.url,
          originalPath: uploaded.storagePath,
          safeZones: safeZones ? JSON.parse(safeZones) : {},
          crops: {
            square: null,
            portrait: null,
            mobile: null,
            hero: null
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await db.collection("images").insertOne(imageDoc);

        response.json({
          ok: true,
          imageId: String(result.insertedId),
          image: { ...imageDoc, id: String(result.insertedId) }
        });
      } catch (error) {
        next(error);
      } finally {
        await cleanupUploadedFile(request.file);
      }
    }
  );

  app.post("/api/admin/images/:id/crops", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const { id } = request.params;
      const { cropType, cropData } = request.body;

      if (!cropType || !cropData) {
        response.status(400).json({ error: "Crop type and data are required." });
        return;
      }

      if (!ObjectId.isValid(id)) {
        response.status(400).json({ error: "Invalid image id." });
        return;
      }

      const db = await getDb();
      const result = await db.collection("images").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            [`crops.${cropType}`]: cropData,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        response.status(404).json({ error: "Image not found." });
        return;
      }

      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/images", verifyAdmin, async (_request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const db = await getDb();
      const images = await db.collection("images").find({}).sort({ createdAt: -1 }).toArray();
      const formatted = images.map((img) => ({
        ...img,
        id: String(img._id)
      }));

      response.json({ images: formatted });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/images/:id", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const { id } = request.params;
      const updates = request.body;

      if (!ObjectId.isValid(id)) {
        response.status(400).json({ error: "Invalid image id." });
        return;
      }

      const db = await getDb();
      const result = await db.collection("images").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        response.status(404).json({ error: "Image not found." });
        return;
      }

      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  registerImageRoutes
};
