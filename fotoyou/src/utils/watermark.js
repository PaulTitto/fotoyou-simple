/**
 * Fungsi untuk menghasilkan gambar dengan pola watermark diagonal yang berulang.
 * @param {string} imageUrl URL gambar asli.
 * @param {boolean} isForDownload Jika true, akan mengembalikan Blob. Jika false, akan mengembalikan DataURL.
 * @returns {Promise<string|Blob>} Promise yang akan resolve dengan DataURL (string) atau Blob.
 */
export const generateWatermarkedImage = (imageUrl, isForDownload = false) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
   
      img.crossOrigin = 'Anonymous';
   
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
   
        ctx.drawImage(img, 0, 0);
   
  
        ctx.save();
  
        const watermarkText = `© ${new Date().getFullYear()} FotoYou`;
        const fontSize = canvas.width / 15; 
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
  
        const angleInRadians = -30 * Math.PI / 180;
        ctx.rotate(angleInRadians);
  
        const horizontalSpacing = fontSize * 6;
        const verticalSpacing = fontSize * 4;
  
        const diagonal = Math.sqrt(canvas.width**2 + canvas.height**2);
  
        for (let x = -diagonal; x < diagonal * 2; x += horizontalSpacing) {
          for (let y = -diagonal; y < diagonal * 2; y += verticalSpacing) {
            ctx.fillText(watermarkText, x, y);
          }
        }

       
  
        ctx.restore();
  
  
        if (isForDownload) {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Gagal membuat blob dari canvas.'));
            }
          }, 'image/png');
        } else {
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        }
      };
   
      img.onerror = (err) => {
        console.error('Gagal memuat gambar untuk watermarking', err);
        resolve(imageUrl); 
      };
   
      img.src = imageUrl;
    });
  };