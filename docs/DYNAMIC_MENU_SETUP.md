# 🎯 Dynamic Menu Loading - Implementation Guide

**Purpose:** Automatically load menu images from folders without code changes  
**Status:** Ready to Implement  
**Time Required:** 30 minutes setup

---

## 📁 Folder Structure

### **Current Setup**
```
D:\MyBusiness\HomiCart\
├── Menu\
│   ├── Al Fayoumy\
│   │   ├── item1.jpg
│   │   ├── item2.jpg
│   │   └── ...
│   └── Al Rokn AL masry\
│       ├── item1.jpg
│       ├── item2.jpg
│       └── ...
├── frontend\
│   └── app-v2.html (uses this)
└── backend\
    └── RouteOrder.js (enhanced with new endpoints)
```

### **How It Works**
1. **User selects store** → Folder name stored in state
2. **Menu page loads** → Calls API with folder name
3. **Backend reads folder** → Lists all images
4. **Images displayed** → Auto-updated when files change

---

## 🔧 Backend Setup

### **Add to RouteOrder.js**

```javascript
// ========== MENU IMAGE LOADING ==========

function getMenuImages(vendorFolder) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Get menu images from Google Drive folder
    const folders = DriveApp.getFoldersByName(vendorFolder);
    
    if (!folders.hasNext()) {
      return { success: false, message: 'Folder not found: ' + vendorFolder };
    }
    
    const folder = folders.next();
    const images = [];
    
    // Get all image files
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();
      
      // Only include image files
      if (mimeType.includes('image')) {
        images.push({
          name: file.getName().replace(/\.[^/.]+$/, ''), // Remove extension
          filename: file.getName(),
          id: file.getId(),
          size: file.getSize(),
          url: 'https://drive.google.com/uc?export=view&id=' + file.getId()
        });
      }
    }
    
    return {
      success: true,
      folder: vendorFolder,
      count: images.length,
      images: images.sort((a, b) => a.name.localeCompare(b.name))
    };
  } catch (error) {
    console.error('Error in getMenuImages:', error);
    return { success: false, message: error.toString() };
  }
}

function listMenuFolders() {
  try {
    const rootFolder = DriveApp.getFolderByName('HomiCart');
    const menuFolder = rootFolder.getFoldersByName('Menu').next();
    
    const folders = [];
    const subFolders = menuFolder.getFolders();
    
    while (subFolders.hasNext()) {
      const folder = subFolders.next();
      const files = folder.getFiles();
      let fileCount = 0;
      while (files.hasNext()) {
        files.next();
        fileCount++;
      }
      
      folders.push({
        name: folder.getName(),
        itemCount: fileCount,
        id: folder.getId()
      });
    }
    
    return { success: true, folders: folders };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}
```

### **Add to doGet() function**

Add these handlers in the `doGet` function:

```javascript
else if (action === 'getMenuImages') {
  result = getMenuImages(e.parameter.vendor);
}
else if (action === 'listMenuFolders') {
  result = listMenuFolders();
}
```

### **Update availableActions array**

Add to the actions list:
```javascript
'getMenuImages', 'listMenuFolders'
```

---

## 🎨 Frontend Integration

### **Update app-v2.html - loadMenu() function**

Replace the current hardcoded menu with:

```javascript
async function loadMenu() {
  if (!state.store) return;

  document.getElementById('storeBreadcrumb').textContent = state.store.name;
  document.getElementById('storeNameHeader').textContent = state.store.name;
  document.getElementById('storeInfoHeader').textContent = 'استعرض قائمة الطعام واختر ما يعجبك';

  // Load menu images from backend
  try {
    const response = await fetch(
      API_URL + '?action=getMenuImages&vendor=' + 
      encodeURIComponent(state.store.folder)
    );
    const data = await response.json();

    if (!data.success) {
      document.getElementById('emptyMenu').style.display = 'block';
      document.getElementById('menuContainer').style.display = 'none';
      return;
    }

    const menuItems = data.images;

    if (menuItems.length === 0) {
      document.getElementById('emptyMenu').style.display = 'block';
      document.getElementById('menuContainer').style.display = 'none';
      return;
    }

    const html = menuItems.map((item, index) => `
      <div class="menu-item">
        <div class="menu-item-image" style="background-image: url('${item.url}'); background-size: cover;">
          <img src="${item.url}" style="display: none;">
          <div class="menu-overlay">
            <button onclick="viewLightbox('${item.url}', '${item.name}')">
              <i class="fas fa-eye"></i> عرض
            </button>
          </div>
        </div>
        <div class="menu-info">
          <div class="menu-name">${item.name}</div>
          <div class="menu-file" title="${item.filename}">
            <small>${item.filename}</small>
          </div>
          <button onclick="addToCart('${item.name}')" 
                  style="width: 100%; background: var(--primary); color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
            <i class="fas fa-plus"></i> أضف للسلة
          </button>
        </div>
      </div>
    `).join('');

    document.getElementById('menuContainer').innerHTML = html;
    document.getElementById('emptyMenu').style.display = 'none';
    document.getElementById('menuContainer').style.display = 'grid';

  } catch (error) {
    console.error('Error loading menu:', error);
    document.getElementById('emptyMenu').style.display = 'block';
    document.getElementById('menuContainer').style.display = 'none';
  }
}
```

### **Update viewLightbox function**

```javascript
function viewLightbox(imageUrl, imageName) {
  document.getElementById('lightbox').classList.add('active');
  document.getElementById('lightboxImage').src = imageUrl;
  document.getElementById('lightboxImage').alt = imageName;
}
```

---

## ✅ Setup Verification Checklist

### **Google Drive Setup**
- [ ] Create folder structure:
  - `HomiCart/Menu/Al Fayoumy/` with images
  - `HomiCart/Menu/Al Rokn AL masry/` with images
- [ ] Images are JPG or PNG format
- [ ] Folder names match exactly (case-sensitive)
- [ ] Google Drive API enabled in project

### **Backend Setup**
- [ ] Added getMenuImages() function to RouteOrder.js
- [ ] Added listMenuFolders() function
- [ ] Updated doGet() to handle new actions
- [ ] Deployed updated RouteOrder.js to Apps Script
- [ ] Copied new deployment URL

### **Frontend Setup**
- [ ] Updated API_URL in app-v2.html with new deployment URL
- [ ] Updated loadMenu() function with API call
- [ ] Updated viewLightbox() function
- [ ] Tested menu loading locally

### **Testing**
- [ ] [ ] Load app in browser
- [ ] [ ] Go through phone verification
- [ ] [ ] Select store
- [ ] [ ] Set location
- [ ] [ ] Menu loads with images
- [ ] [ ] Click image shows lightbox
- [ ] [ ] Add to cart works
- [ ] [ ] Images display correctly on mobile

---

## 🚀 Testing the Dynamic Menu

### **Step 1: Manual Test**

```javascript
// In browser console:
fetch('YOUR_API_URL?action=getMenuImages&vendor=Al%20Fayoumy')
  .then(r => r.json())
  .then(d => console.log(d))
```

Expected output:
```json
{
  "success": true,
  "folder": "Al Fayoumy",
  "count": 5,
  "images": [
    {
      "name": "item1",
      "filename": "item1.jpg",
      "id": "...",
      "url": "https://drive.google.com/uc?export=view&id=..."
    }
  ]
}
```

### **Step 2: Browser Test**

1. Open app-v2.html
2. Enter phone number
3. Select "Al Fayoumy"
4. Set location
5. Menu should display all images from the folder

### **Step 3: Add/Remove Test**

1. Add new image to `Al Fayoumy` folder
2. Reload menu page
3. New image should appear automatically ✅

4. Delete an image from folder
5. Reload menu page
6. Image should disappear automatically ✅

---

## 🎯 Real-World Usage

### **Adding New Menu Items**

**Currently (Manual):**
- Edit HTML code
- Add new item to array
- Deploy changes

**With Dynamic Loading:**
- Drag image to folder
- Refresh page
- Done! ✅

### **Updating Menu**

**Currently:**
- Rename image, update code, deploy

**With Dynamic Loading:**
- Delete image, add new one
- No code changes needed ✅

### **Multiple Stores**

**With Dynamic Loading:**
- Each store has own folder
- Images auto-sorted by name
- Perfect for large menus ✅

---

## 📊 Performance Considerations

### **Optimization Tips**

1. **Compress Images**
   - Use 800x600px for menu items
   - JPG format with 85% quality
   - Aim for < 200KB per image

2. **Folder Organization**
   - Group by category
   - Name files: `001-item-name.jpg`
   - Makes sorting easier

3. **Caching**
   - Browser caches Drive images
   - Set proper cache headers
   - Google Drive handles this automatically

4. **API Limits**
   - Google Drive API is fast
   - No rate limits for reasonable usage
   - ~1000 images should load in <5 seconds

---

## 🐛 Troubleshooting

### **Images not showing?**

**Check:**
1. Folder names match exactly (including spaces)
2. API URL is correct
3. Google Drive API enabled
4. Images are in correct folder
5. Browser cache cleared

**Test:**
```javascript
// Check folder exists:
fetch('YOUR_API?action=listMenuFolders')
  .then(r => r.json())
  .then(d => console.log(d.folders))
```

### **"Folder not found" error?**

- Check folder name spelling (case-sensitive!)
- Verify folder path: HomiCart > Menu > Folder Name
- Ensure images are inside the folder

### **Images load slowly?**

- Compress images smaller
- Reduce number of images
- Enable browser caching

### **API returning empty?**

- Check folder has images
- Verify image file formats (jpg, png)
- Check Drive permissions

---

## 📚 Example Folder Structure

```
Google Drive/
└── HomiCart/
    └── Menu/
        ├── Al Fayoumy/
        │   ├── 001-salad.jpg
        │   ├── 002-main-course.jpg
        │   ├── 003-dessert.jpg
        │   └── 004-beverage.jpg
        └── Al Rokn AL masry/
            ├── 001-lamb.jpg
            ├── 002-chicken.jpg
            ├── 003-kebab.jpg
            └── 004-mixed-grill.jpg
```

---

## ✨ Benefits of Dynamic Loading

| Aspect | Before | After |
|--------|--------|-------|
| **Add item** | Edit code + deploy | Drag image to folder |
| **Remove item** | Edit code + deploy | Delete image |
| **Update menu** | Code change needed | Just update images |
| **Time to update** | 15 min | 30 seconds |
| **Technical skill** | Coding required | Folder management |
| **Error risk** | High (code errors) | Low (just images) |
| **Scalability** | 100s items hard | 1000s items easy |

---

## 🎉 Result

✅ **No more code changes for menu updates**  
✅ **Changes appear instantly**  
✅ **Non-technical staff can manage menu**  
✅ **Professional, scalable system**  
✅ **Easy to maintain long-term**

---

**Status: ✅ Ready to Deploy**

Once implemented, menu management becomes a simple file operation instead of code editing!
