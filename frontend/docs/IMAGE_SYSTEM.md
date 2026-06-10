# Valluru Image Management System

## Overview

A professional editorial-grade image management system that preserves sacred artwork integrity while maintaining responsive behavior across all devices.

## System Architecture

### Frontend Components

#### 1. `VallruImage` Component (`/components/valluru-image.tsx`)
The main image rendering component that automatically selects the appropriate crop.

**Usage:**
```tsx
import { VallruImage } from "@/components/valluru-image";

<VallruImage
  id={imageId}
  title="Varanasi Ghats"
  originalImage={originalUrl}
  crops={{
    square: squareCropUrl,
    portrait: portraitCropUrl,
    mobile: mobileCropUrl,
    hero: heroCropUrl
  }}
  context="booklet-card"
  alt="Movement 1, Booklet 3"
/>
```

**Context Options:**
- `booklet-card` → Uses square crop (1:1)
- `booklet-detail` → Uses portrait crop (4:5)
- `movement-hero` → Uses hero crop (16:10)
- `mobile` → Uses mobile crop (9:16)
- `full` → Uses original uncrapped image

**Features:**
- Automatic crop selection based on context
- Lazy loading with blur placeholders
- Error fallback with gradient
- Loading state animation
- Responsive srcset support

#### 2. `ImageManagerPanel` Component (`/components/image-manager-panel.tsx`)
Admin UI for uploading and managing images.

**Features:**
- Select Movement and Booklet
- Specify image type (cover, hero, gallery)
- Upload original image
- View uploaded images with metadata
- Track image IDs for crop data

### Backend API Endpoints

#### POST `/api/admin/images/upload`
Upload a new image and store metadata.

**Request:**
```json
{
  "image": File,
  "movement": "1",
  "booklet": "3",
  "imageType": "cover",
  "title": "Varanasi Ghats"
}
```

**Response:**
```json
{
  "ok": true,
  "imageId": "507f1f77bcf86cd799439011",
  "image": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Varanasi Ghats",
    "movement": 1,
    "booklet": 3,
    "originalImage": "https://...",
    "crops": {
      "square": null,
      "portrait": null,
      "mobile": null,
      "hero": null
    }
  }
}
```

#### POST `/api/admin/images/:id/crops`
Save crop data for a specific image and crop type.

**Request:**
```json
{
  "cropType": "portrait",
  "cropData": {
    "x": 100,
    "y": 200,
    "width": 800,
    "height": 1000,
    "url": "https://cropped-image-url"
  }
}
```

#### GET `/api/admin/images`
List all uploaded images with metadata.

**Response:**
```json
{
  "images": [
    {
      "id": "507f1f77bcf86cd799439011",
      "title": "Varanasi Ghats",
      "movement": 1,
      "booklet": 3,
      "imageType": "cover",
      "originalImage": "https://...",
      "crops": {
        "square": null,
        "portrait": null,
        "mobile": null,
        "hero": null
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### PUT `/api/admin/images/:id`
Update image metadata (title, safe zones, etc.).

**Request:**
```json
{
  "title": "Updated Title",
  "safeZones": {
    "protected": [
      { "name": "deity", "x": 400, "y": 300, "width": 200, "height": 300 }
    ]
  }
}
```

### MongoDB Schema

**Collection: `images`**

```javascript
{
  _id: ObjectId,
  title: String,
  movement: Number,           // 1-5
  booklet: Number | null,     // 1-12 or null for hero
  imageType: String,          // "cover" | "hero" | "gallery"
  
  // Original image stored in Supabase
  originalImage: String,      // Public URL
  originalPath: String,       // Storage path
  
  // Crop data (URLs stored after cropping service generates them)
  crops: {
    square: String | null,    // 1:1 crop URL
    portrait: String | null,  // 4:5 crop URL
    mobile: String | null,    // 9:16 crop URL
    hero: String | null       // 16:10 crop URL
  },
  
  // Safe zone protection
  safeZones: {
    protected: [
      {
        name: String,       // e.g., "deity", "lamp", "manuscript"
        x: Number,
        y: Number,
        width: Number,
        height: Number
      }
    ]
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

## Usage Workflow

### Step 1: Admin Uploads Image
1. Go to Admin Panel → Images tab
2. Select Movement (1-5)
3. Optionally select Booklet (for cover images)
4. Select Image Type (cover, hero, gallery)
5. Upload image file
6. System stores original in Supabase and metadata in MongoDB

### Step 2: Generate Crops (Future)
Once crop generation is implemented:
1. Select image from list
2. Preview crop zones for each format
3. Adjust crop coordinates manually if needed
4. Generate/save crops
5. Crop URLs are stored in database

### Step 3: Frontend Rendering
Components automatically use the correct crop:

```tsx
// On booklet cards → uses square crop
<BookletCard booklet={booklet} />

// On booklet detail → uses portrait crop
<VallruImage
  context="booklet-detail"
  crops={imageCrops}
/>

// On mobile → uses mobile crop
<VallruImage
  context="mobile"
  crops={imageCrops}
/>
```

## Safe Zones Configuration

Each movement's safe zones are documented to prevent text overlay issues:

### Movement 1: Dharma / Silence
- **Booklet 2**: Liṅga, Offerings, Lamps, Smoke, Nāda
- **Booklet 3**: Venkateswara, Poet-devotee, Palm-leaf manuscript, Veena, Lamps

### Movement 2: Māyā / Witness
- **Booklet 4**: Train window, Seeker, Twilight landscape
- **Booklet 5**: Hanuman, Halo, Folded hands, Mace
- **Booklet 10**: Burning chessboard, Seeker, Golden light, Smoke
- **Booklet 11**: Seeker, Fading festival, Lamps, Wilting flowers

### Movement 3: Grief / Fire / Nāda
- **Hero**: Seeker, Fire, Nāda axis, Grief-to-vow transformation
- **Booklet 6**: Crying seeker, Liṅga, Veena/Tanpura, Smoke
- **Booklet 7**: Krishna, Warrior, Chariot, Horses

### Movement 4: Language / Surrender
- **Booklet 8**: Śiva, Damaru, Flame hand, Serpent, Devotee, Trident
- **Booklet 12**: Śiva, Crescent moon, Liṅga, Manuscript, Lamps

### Movement 5: Love / Kali / Anchor
- **Booklet 9**: Amma-child embrace, Kāli presence, Bells, Lamps, Offerings

## Aspect Ratios

- **Square** (1:1): Booklet cards in series grid
- **Portrait** (4:5): Booklet detail pages, primary viewing format
- **Mobile** (9:16): Mobile device displays
- **Hero** (16:10): Movement landing page hero sections
- **Full**: Original uncrapped image

## Performance Considerations

- **Lazy loading**: Images load only when needed
- **Blur placeholders**: Provides visual feedback while loading
- **Next.js Image**: Automatic optimization and responsive srcsets
- **CDN delivery**: All images served through Supabase CDN
- **Quality**: Default 85% quality balances file size and visual fidelity

## Future Enhancements

### Phase 2: Automated Crop Generation
- Implement smart crop detection using AI
- Automatic safe zone recognition
- One-click crop generation for all formats

### Phase 3: Advanced Features
- Crop preview editor with manual adjustment
- Batch crop generation
- Crop templates per movement
- A/B testing crop variations

### Phase 4: Integration
- Automatically apply crops to published booklets
- Dynamic image selection based on device/viewport
- Responsive srcset generation
- WebP/AVIF format conversion

## Troubleshooting

**Images not appearing:**
- Check Supabase bucket permissions
- Verify storage path is correct
- Check CORS headers if loading cross-origin

**Crops not applying:**
- Ensure crop data is saved in MongoDB
- Verify crop URLs are valid
- Check image context matches intended use

**Performance issues:**
- Reduce image dimensions
- Enable image optimization in Next.js config
- Use appropriate crop format for context

## Integration with Existing Components

Currently, components still use the `coverImage` field directly. To integrate the new system:

1. Update BookletCard to use `VallruImage` component
2. Store image IDs in booklet metadata instead of URLs
3. Fetch crop data from API in page components
4. Pass crops to VallruImage for automatic selection

This maintains backward compatibility while preparing for full image system adoption.
