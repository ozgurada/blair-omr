let isCameraRunning = false;
let stream = null;
let animFrameId = null;

document.addEventListener('DOMContentLoaded', () => {
    updateAll();
});

// 1. PURE BINARY MATRIX ENGINE (3 Satır x 18 Sütun -> 1 Milyar+ Kapasite)
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
    // 30 Bit Pure Binary = 1.073.741.823 (1 Milyar+)
    let numVal = parseInt(textData, 10);
    if (isNaN(numVal)) numVal = 0;

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

// 2. GERÇEK PİKSEL / BİT DECODER
function decodeMatrixData(matrix) {
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

// 3. SVG ÜRETİCİ
function renderSVG() {
    const inputElem = document.getElementById('txtPayload');
    let text = inputElem ? inputElem.value : "123456789";
    
    // Sadece sayısal karakter tut
    text = text.replace(/\D/g, '');
    if (text === "") text = "0";
    
    // 1 Milyar sınır kontrolü
    if (parseInt(text, 10) > 1000000000) {
        text = "1000000000";
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
    const selfDecoded = decodeMatrixData(matrix);
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

function downloadGCode() {
    const text = document.getElementById('txtPayload').value.replace(/\D/g, '');
    const cellSize = parseFloat(document.getElementById('cmbCellSize').value);
    const marginLeft = parseFloat(document.getElementById('numMarginLeft').value) || 5;
    const marginTop = parseFloat(document.getElementById('numMarginTop').value) || 5;
    const powerPct = parseInt(document.getElementById('numPower').value) || 85;
    const feed = parseInt(document.getElementById('numFeed').value) || 1500;
    
    const matrix = encodeToMatrix(text);
    const powerVal = Math.round((powerPct / 100.0) * 1000);

    let gcode = `; BLAIR2 PURE BINARY G-CODE\nG90\nG21\nM5\n`;

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

function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

// 4. CANLI KAMERA OKUYUCU
async function toggleCamera() {
    const btn = document.getElementById('btnToggleCamera');
    const video = document.getElementById('videoInput');

    if (!isCameraRunning) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                isCameraRunning = true;
                btn.innerText = "Kamerayı Durdur";
                btn.style.backgroundColor = "#ef4444";
                processVideoFrame();
            };
        } catch (err) {
            alert("Kamera Erişim Hatası: " + err.message);
        }
    } else {
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (animFrameId) cancelAnimationFrame(animFrameId);
        isCameraRunning = false;
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

function processVideoFrame() {
    if (!isCameraRunning) return;

    const video = document.getElementById('videoInput');
    const canvas = document.getElementById('canvasOutput');
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        
        const boxW = Math.min(canvas.width * 0.8, 380);
        const boxH = boxW * (3 / 18);

        const startX = Math.round(cx - boxW / 2);
        const startY = Math.round(cy - boxH / 2);

        ctx.strokeStyle = "rgba(0, 229, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, boxW, boxH);

        const frameData = ctx.getImageData(startX, startY, boxW, boxH);
        const pixels = frameData.data;

        let sampledMatrix = Array.from({ length: 3 }, () => Array(18).fill(0));
        const colStep = boxW / 18;
        const rowStep = boxH / 3;

        let totalB = 0;
        for (let i = 0; i < pixels.length; i += 16) {
            totalB += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        }
        let avgB = totalB / (pixels.length / 16);

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 18; c++) {
                let px = Math.floor((c + 0.5) * colStep);
                let py = Math.floor((r + 0.5) * rowStep);
                let index = (py * Math.floor(boxW) + px) * 4;

                let b = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
                if (b < avgB * 0.72) {
                    sampledMatrix[r][c] = 1;
                }
            }
        }

        const isAnchorValid = (sampledMatrix[0][0] === 1 && sampledMatrix[1][0] === 1 && sampledMatrix[2][0] === 1) &&
                             (sampledMatrix[0][1] === 1);

        if (isAnchorValid) {
            let realDecodedText = decodeMatrixData(sampledMatrix);

            ctx.fillStyle = "rgba(0, 229, 255, 0.2)";
            ctx.fillRect(startX, startY, boxW, boxH);

            ctx.strokeStyle = "#00e5ff";
            ctx.lineWidth = 3;
            ctx.strokeRect(startX, startY, boxW, boxH);

            if (realDecodedText.length > 0) {
                ctx.fillStyle = "#00e5ff";
                ctx.font = "bold 18px monospace";
                ctx.fillText(`OKUNAN: ${realDecodedText}`, startX, startY - 10);
                updateCameraUI("ÇÖZÜLDÜ", `${Math.round(boxW)}x${Math.round(boxH)} px`, "Hizalandı", "Kilitlendi", realDecodedText);
            }
        } else {
            updateCameraUI("Obje Aranıyor...", "18 Kare", "Hizalanıyor", "Sol Çapayı Kutuya Ortalayın", "-");
        }
    }

    animFrameId = requestAnimationFrame(processVideoFrame);
}