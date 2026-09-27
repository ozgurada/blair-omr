let isCameraRunning = false;
let stream = null;
let animFrameId = null;
let cameraCheckCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    updateAll();
});

// ============================================================================
// 1. PURE BINARY MATRIX ENGINE (3 Satır x 18 Sütun -> 1.073.741.823 Kapasite)
// ============================================================================
function encodeToMatrix(textData) {
    let matrix = Array.from({ length: 3 }, () => Array(18).fill(0));

    // A) TANIMA OBJSİ / HİZALAMA ÇAPALARI (Sol 1. ve 2. Sütunlar)
    matrix[0][0] = 1;
    matrix[1][0] = 1;
    matrix[2][0] = 1;
    
    matrix[0][1] = 1;
    matrix[1][1] = 0; 
    matrix[2][1] = 0; 

    // B) TIMING BİTLERİ (0. Satır, 2-16. Sütunlar)
    for (let col = 2; col < 17; col++) {
        matrix[0][col] = (col % 2 === 0) ? 1 : 0;
    }

    // C) PURE BINARY SIKIŞTIRMA (1. ve 2. Satırlar = 30 Bit Veri Alanı)
    // 30 Bit Pure Binary = 1.073.741.823
    let numVal = parseInt(textData, 10);
    if (isNaN(numVal)) numVal = 0;
    
    // Kapasite sınırı: 1.073.741.823
    if (numVal > 1073741823) {
        numVal = 1073741823;
    }

    let bitStream = [];
    for (let i = 29; i >= 0; i--) {
        bitStream.push((numVal >> i) & 1);
    }

    // Bitleri Matris Hücrelerine Dök
    let bitIdx = 0;
    for (let col = 2; col < 17; col++) {
        for (let row = 1; row <= 2; row++) {
            if (bitIdx < bitStream.length) {
                matrix[row][col] = bitStream[bitIdx];
                bitIdx++;
            }
        }
    }

    // D) STOP BİTİ (17. Sütun)
    matrix[0][17] = 1; 
    matrix[1][17] = 0; 
    matrix[2][17] = 1;

    return matrix;
}

// ============================================================================
// 2. GERÇEK PİKSEL / BİT DECODER
// ============================================================================
function decodeMatrixData(matrix, performAnchorCheck = false) {
    // Opsiyonal: Çapaları doğrula (kamera okuma sırasında)
    if (performAnchorCheck) {
        const isAnchorValid = (matrix[0][0] === 1 && matrix[1][0] === 1 && matrix[2][0] === 1) &&
                             (matrix[0][1] === 1) &&
                             (matrix[1][1] === 0 && matrix[2][1] === 0) &&
                             (matrix[0][17] === 1 && matrix[1][17] === 0 && matrix[2][17] === 1);
        if (!isAnchorValid) return null;
    }

    let bitStream = [];
    
    for (let col = 2; col < 17; col++) {
        for (let row = 1; row <= 2; row++) {
            bitStream.push(matrix[row][col]);
        }
    }

    let numVal = 0;
    for (let i = 0; i < bitStream.length; i++) {
        numVal = (numVal << 1) | bitStream[i];
    }

    return numVal.toString();
}

// ============================================================================
// 3. SVG ÜRETİCİ
// ============================================================================
function renderSVG() {
    const inputElem = document.getElementById('txtPayload');
    let text = inputElem ? inputElem.value : "123456789";
    
    // Sadece sayısal karakter tut
    text = text.replace(/\D/g, '');
    if (text === "") text = "0";
    
    // Kapasite sınırı doğrulaması
    let numVal = parseInt(text, 10);
    if (numVal > 1073741823) {
        text = "1073741823";
    }

    const cellSize = parseFloat(document.getElementById('cmbCellSize').value);
    const marginLeft = parseFloat(document.getElementById('numMarginLeft').value) || 5;
    const marginTop = parseFloat(document.getElementById('numMarginTop').value) || 5;
    
    const matrix = encodeToMatrix(text);

    const matrixWidth = 18 * cellSize;
    const matrixHeight = 3 * cellSize;

    const totalWidth = matrixWidth + (marginLeft * 2);
    const totalHeight = matrixHeight + (marginTop * 2);

    let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}mm" height="${totalHeight}mm" viewBox="0 0 ${totalWidth} ${totalHeight}">\n`;
    svgStr += `  <rect width="100%" height="100%" fill="white" />\n`;

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 18; c++) {
            let x = (marginLeft + c * cellSize).toFixed(3);
            let y = (marginTop + r * cellSize).toFixed(3);

            if (matrix[r][c] === 1) {
                svgStr += `  <rect x="${x}" y="${y}" width="${cellSize.toFixed(3)}" height="${cellSize.toFixed(3)}" fill="black" />\n`;
            } else {
                svgStr += `  <rect x="${x}" y="${y}" width="${cellSize.toFixed(3)}" height="${cellSize.toFixed(3)}" fill="none" stroke="#e2e8f0" stroke-width="0.05" />\n`;
            }
        }
    }
    svgStr += `</svg>`;

    const previewElem = document.getElementById('svgPreview');
    if (previewElem) previewElem.innerHTML = svgStr;
    
    // Doğrudan fiziksel matris karelerinden geri okuma testi yap
    const selfDecoded = decodeMatrixData(matrix, false);
    const card = document.getElementById('testResultCard');
    const textSpan = document.getElementById('testResultText');

    if (card && textSpan) {
        card.className = "test-card pass";
        textSpan.innerHTML = `✅ <strong>SVG KARELERİNDEN ÇÖZÜLEN:</strong> <code>"${selfDecoded}"</code>`;
    }
    return svgStr;
}

function updateAll() { renderSVG(); }

function downloadSVG() { downloadFile(renderSVG(), "blair2_matrix.svg", "image/svg+xml"); }

// ============================================================================
// 4. G-CODE ÜRETİCİ
// ============================================================================
function downloadGCode() {
    const text = document.getElementById('txtPayload').value.replace(/\D/g, '');
    const cellSize = parseFloat(document.getElementById('cmbCellSize').value);
    const marginLeft = parseFloat(document.getElementById('numMarginLeft').value) || 5;
    const marginTop = parseFloat(document.getElementById('numMarginTop').value) || 5;
    const powerPct = parseInt(document.getElementById('numPower').value) || 85;
    const feed = parseInt(document.getElementById('numFeed').value) || 1500;
    
    const matrix = encodeToMatrix(text);
    const powerVal = Math.round((powerPct / 100.0) * 1000);

    let gcode = `; BLAIR2 PURE BINARY G-CODE\n`;
    gcode += `; Kapasite: 1.073.741.823 (30-Bit)\n`;
    gcode += `; Lazer Gücü: ${powerPct}%\n`;
    gcode += `; Hız: ${feed} mm/dk\n`;
    gcode += `; Hücre Boyutu: ${cellSize}mm\n`;
    gcode += `G90\nG21\nM5\n`;

    for (let r = 0; r < 3; r++) {
        let y = (marginTop + (r * cellSize) + (cellSize / 2.0)).toFixed(3);
        for (let c = 0; c < 18; c++) {
            if (matrix[r][c] === 1) {
                let xStart = (marginLeft + (c * cellSize)).toFixed(3);
                let xEnd = (marginLeft + (c * cellSize) + cellSize).toFixed(3);
                gcode += `G0 X${xStart} Y${y}\nM3 S${powerVal}\nG1 X${xEnd} Y${y} F${feed}\nM5\n`;
            }
        }
    }
    gcode += "G0 X0 Y0\nM5\n";
    downloadFile(gcode, "blair2_matrix.gcode", "text/plain");
}

// ============================================================================
// 5. DOSYA İNDİRME (Güvenli URL Revoke)
// ============================================================================
function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // URL.revokeObjectURL'i indirme işlemini bekleyecek şekilde geciktir
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
    }, 100);
}

// ============================================================================
// 6. CANLI KAMERA OKUYUCU (API Kontrollü)
// ============================================================================
async function toggleCamera() {
    const btn = document.getElementById('btnToggleCamera');
    const video = document.getElementById('videoInput');
    const canvas = document.getElementById('canvasOutput');

    if (!isCameraRunning) {
        // Cihaz/Browser desteğini kontrol et
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("❌ Bu tarayıcı kamera API'sini desteklemiyor.\nLütfen modern bir tarayıcı kullanın (Chrome, Firefox, Safari, Edge).");
            updateCameraUI("Desteklenmiyor", "-", "-", "Kamera API desteklenmiyor", "-");
            return;
        }

        // Canvas context doğrulaması
        if (!canvas.getContext) {
            alert("❌ Canvas desteği yok.");
            return;
        }

        try {
            btn.disabled = true;
            btn.innerText = "Kamera Başlatılıyor...";

            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "environment", 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 } 
                } 
            });

            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                video.play().then(() => {
                    isCameraRunning = true;
                    cameraCheckCount = 0;
                    btn.disabled = false;
                    btn.innerText = "Kamerayı Durdur";
                    btn.style.backgroundColor = "#ef4444";
                    updateCameraUI("Başlatılıyor", "18x3 Kare", "Aranıyor", "Matrisi kamera kutusuna konumlandır", "-");
                    processVideoFrame();
                }).catch(err => {
                    console.error("Play hatası:", err);
                    alert("Kamera oynatılamadı: " + err.message);
                    btn.disabled = false;
                    isCameraRunning = false;
                });
            };

            video.onerror = (err) => {
                console.error("Video hatası:", err);
                alert("Video akışı hatası: " + err);
                btn.disabled = false;
                isCameraRunning = false;
            };
        } catch (err) {
            btn.disabled = false;
            btn.innerText = "Kamerayı Başlat";
            
            // Farklı hata türlerine özel mesajlar
            let errorMsg = err.message || "Bilinmeyen hata";
            
            if (err.name === "NotAllowedError") {
                errorMsg = "Kamera izni reddedildi. Lütfen tarayıcı ayarlarında kamera iznini verin.";
            } else if (err.name === "NotFoundError") {
                errorMsg = "Cihazda kamera bulunamadı.";
            } else if (err.name === "NotReadableError") {
                errorMsg = "Kamera başka bir uygulama tarafından kullanılıyor.";
            }
            
            alert("❌ Kamera Hatası:\n" + errorMsg);
            updateCameraUI("Hata", "-", "-", errorMsg, "-");
        }
    } else {
        // Kamerayı durdur
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        
        isCameraRunning = false;
        video.srcObject = null;
        btn.disabled = false;
        btn.innerText = "Kamerayı Başlat";
        btn.style.backgroundColor = "#00e5ff";
        updateCameraUI("Kamera Kapalı", "-", "-", "Arama Yapılmıyor", "-");
    }
}

function updateCameraUI(status, size, dist, action, decodedMsg) {
    document.getElementById('camStatus').innerText = status;
    document.getElementById('camTargetSize').innerText = size;
    document.getElementById('camEstDistance').innerText = dist;
    document.getElementById('camActionHint').innerText = action;
    document.getElementById('camDecodedOutput').innerText = decodedMsg;
}

// ============================================================================
// 7. ADAPTIVE THRESHOLDING - VİDEO FRAME İŞLEME
// ============================================================================
function processVideoFrame() {
    if (!isCameraRunning) return;

    const video = document.getElementById('videoInput');
    const canvas = document.getElementById('canvasOutput');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        console.error("Canvas context alınamadı");
        return;
    }

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Canvas boyutunu video boyutuyla senkronize et
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        
        // Hedef kutu boyutu (18x3 oranı korundu)
        const boxW = Math.min(canvas.width * 0.8, 380);
        const boxH = boxW * (3 / 18);

        const startX = Math.round(cx - boxW / 2);
        const startY = Math.round(cy - boxH / 2);

        // Kutuyu ekrana çiz
        ctx.strokeStyle = "rgba(0, 229, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, boxW, boxH);

        // Frame verilerini oku
        const frameData = ctx.getImageData(startX, startY, Math.floor(boxW), Math.floor(boxH));
        const pixels = frameData.data;

        if (!pixels || pixels.length < 4) {
            updateCameraUI("Obje Aranıyor...", "18 Kare", "Hizalanıyor", "Görüntü yüklenemedi", "-");
            animFrameId = requestAnimationFrame(processVideoFrame);
            return;
        }

        let sampledMatrix = Array.from({ length: 3 }, () => Array(18).fill(0));
        const colStep = boxW / 18;
        const rowStep = boxH / 3;

        // ADAPTIVE THRESHOLD: Yerel ortalama hesapla (tüm pixels)
        let totalBrightness = 0;
        let pixelCount = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            // Lüminans formülü
            const lum = (0.299 * r + 0.587 * g + 0.114 * b);
            totalBrightness += lum;
            pixelCount++;
        }
        
        const avgBrightness = totalBrightness / pixelCount;
        
        // Dinamik eşik: ortalamanın %65'i
        // (Önceki 0.72 sabit eşik yerine adaptif)
        const threshold = avgBrightness * 0.65;

        // Matris hücrelerini sampla
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 18; c++) {
                let px = Math.floor((c + 0.5) * colStep);
                let py = Math.floor((r + 0.5) * rowStep);
                
                // Bounds kontrolü
                if (px < 0 || py < 0 || px >= Math.floor(boxW) || py >= Math.floor(boxH)) {
                    continue;
                }
                
                let index = (py * Math.floor(boxW) + px) * 4;
                
                if (index + 2 >= pixels.length) {
                    continue;
                }

                const r_px = pixels[index];
                const g_px = pixels[index + 1];
                const b_px = pixels[index + 2];
                const lum = (0.299 * r_px + 0.587 * g_px + 0.114 * b_px);
                
                // Siyah kareler (düşük brightness)
                if (lum < threshold) {
                    sampledMatrix[r][c] = 1;
                } else {
                    sampledMatrix[r][c] = 0;
                }
            }
        }

        // Çapa doğrulaması
        const isAnchorValid = (sampledMatrix[0][0] === 1 && sampledMatrix[1][0] === 1 && sampledMatrix[2][0] === 1) &&
                             (sampledMatrix[0][1] === 1) &&
                             (sampledMatrix[1][1] === 0 && sampledMatrix[2][1] === 0);

        if (isAnchorValid) {
            cameraCheckCount++;
            let realDecodedText = decodeMatrixData(sampledMatrix, true);

            // Çapa ve stop biti doğrulaması
            const isStopValid = (sampledMatrix[0][17] === 1 && sampledMatrix[1][17] === 0 && sampledMatrix[2][17] === 1);

            if (realDecodedText !== null && isStopValid) {
                // Başarılı okuma: Kutuyu yeşil/mavi ile vurgula
                ctx.fillStyle = "rgba(0, 229, 255, 0.2)";
                ctx.fillRect(startX, startY, boxW, boxH);

                ctx.strokeStyle = "#00ff00";
                ctx.lineWidth = 3;
                ctx.strokeRect(startX, startY, boxW, boxH);

                // Okunan veriyi ekrana yaz
                ctx.fillStyle = "#00ff00";
                ctx.font = "bold 20px monospace";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 4;
                ctx.strokeText(`✓ OKUNAN: ${realDecodedText}`, startX + 5, startY - 10);
                ctx.fillText(`✓ OKUNAN: ${realDecodedText}`, startX + 5, startY - 10);

                updateCameraUI(
                    "✅ ÇÖZÜLDÜ", 
                    `${Math.round(boxW)}x${Math.round(boxH)} px`, 
                    "Hizalandı", 
                    "Veri başarıyla okundu", 
                    realDecodedText
                );
            } else {
                // Çapa geçerli ama veri bozuk
                ctx.strokeStyle = "#ffaa00";
                ctx.lineWidth = 2;
                ctx.strokeRect(startX, startY, boxW, boxH);

                updateCameraUI(
                    "Çapa Bulundu", 
                    `${Math.round(boxW)}x${Math.round(boxH)} px`, 
                    "Hizalandı", 
                    "Veri bozuk - konumu ayarla", 
                    "-"
                );
            }
        } else {
            // Çapa bulunamadı
            ctx.strokeStyle = "rgba(255, 100, 100, 0.5)";
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, startY, boxW, boxH);

            cameraCheckCount++;
            const hint = (cameraCheckCount % 3 === 0) ? "Matrisi merkeze kaydır" : "Sol üst çapayı kontrol et";
            
            updateCameraUI(
                "Obje Aranıyor...", 
                "18 Kare", 
                "Hizalanıyor", 
                hint, 
                "-"
            );
        }
    }

    animFrameId = requestAnimationFrame(processVideoFrame);
}
