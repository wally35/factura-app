// 📱 GESTOR DE FACTURAS PRO - Detección Ultra Mejorada
let invoices = [];
let currentPhoto = null;
let modoManual = false;

function cargarFacturas() {
    try {
        const stored = localStorage.getItem('invoices');
        if (stored) {
            invoices = JSON.parse(stored);
            console.log('✅ Cargadas ' + invoices.length + ' facturas');
        } else {
            invoices = [];
        }
    } catch (e) {
        console.error('❌ Error:', e);
        invoices = [];
    }
}

function guardarFacturas() {
    try {
        localStorage.setItem('invoices', JSON.stringify(invoices));
        console.log('✅ Guardadas ' + invoices.length + ' facturas');
        return true;
    } catch (e) {
        console.error('❌ Error:', e);
        if (e.name === 'QuotaExceededError') {
            alert('❌ ALMACENAMIENTO LLENO\n\nElimina facturas antiguas o guarda sin foto.');
        }
        return false;
    }
}

const photoCamera = document.getElementById('photo-camera');
const photoGallery = document.getElementById('photo-gallery');
const photoPreview = document.getElementById('photo-preview');
const form = document.getElementById('invoice-form');
const invoiceList = document.getElementById('invoice-list');
const count = document.getElementById('count');
const fechaCalendario = document.getElementById('fecha-calendario');
const fechaManual = document.getElementById('fecha-manual');
const toggleBtn = document.getElementById('toggle-fecha');
const searchInput = document.getElementById('search-input');

if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        renderInvoices(e.target.value.toLowerCase());
    });
}

toggleBtn.addEventListener('click', function() {
    if (modoManual) {
        fechaCalendario.style.display = 'flex';
        fechaManual.style.display = 'none';
        fechaManual.removeAttribute('required');
        fechaCalendario.setAttribute('required', '');
        toggleBtn.textContent = '✏️';
        modoManual = false;
    } else {
        fechaCalendario.style.display = 'none';
        fechaManual.style.display = 'flex';
        fechaCalendario.removeAttribute('required');
        fechaManual.setAttribute('required', '');
        toggleBtn.textContent = '📅';
        modoManual = true;
    }
});

fechaManual.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    if (value.length > 0) formatted = value.substring(0, 2);
    if (value.length >= 3) formatted += '/' + value.substring(2, 4);
    if (value.length >= 5) formatted += '/' + value.substring(4, 8);
    e.target.value = formatted;
});

function toggleGarantiaPersonalizada() {
    const garantiaTipo = document.getElementById('garantia-tipo').value;
    const garantiaCustom = document.getElementById('garantia-custom');
    if (garantiaTipo === 'custom') {
        garantiaCustom.style.display = 'block';
        garantiaCustom.setAttribute('required', '');
    } else {
        garantiaCustom.style.display = 'none';
        garantiaCustom.removeAttribute('required');
    }
}

function calcularGarantia(fechaCompra, años) {
    const fecha = new Date(fechaCompra);
    fecha.setFullYear(fecha.getFullYear() + parseInt(años));
    return fecha.toISOString().split('T')[0];
}

function comprimirImagen(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Mejor resolución para OCR
            if (width > 1200) {
                height = (height * 1200) / width;
                width = 1200;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Mejorar contraste para OCR
            ctx.filter = 'contrast(1.2) brightness(1.1)';
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(base64Image);
        img.src = base64Image;
    });
}

photoCamera.addEventListener('change', async (e) => {
    if (e.target.files[0]) await procesarFoto(e.target.files[0]);
});

photoGallery.addEventListener('change', async (e) => {
    if (e.target.files[0]) await procesarFoto(e.target.files[0]);
});

// 🔍 PROCESAR FOTO CON OCR MEJORADO
async function procesarFoto(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        currentPhoto = await comprimirImagen(e.target.result);
        photoPreview.src = currentPhoto;
        photoPreview.style.display = 'block';
        
        const usarOCR = confirm('¿Analizar factura automáticamente?\n\n' +
                               '✅ SÍ: Detección automática de datos\n' +
                               '❌ NO: Introducir datos manualmente');
        
        if (!usarOCR) return;
        
        const mensaje = document.createElement('div');
        mensaje.id = 'loading-ocr';
        mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 10px; z-index: 10000; text-align: center; max-width: 350px;';
        mensaje.innerHTML = '🤖 Analizando factura...<br><br>' +
                          '<div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-top: 15px;">' +
                          '<div id="progress-bar" style="background: #667eea; height: 8px; border-radius: 4px; width: 0%; transition: width 0.3s;"></div>' +
                          '<div id="progress-text" style="margin-top: 10px; font-size: 12px;">Iniciando...</div>' +
                          '</div>';
        document.body.appendChild(mensaje);
        
        try {
            const progressText = document.getElementById('progress-text');
            const progressBar = document.getElementById('progress-bar');
            
            // OCR con Tesseract MEJORADO
            const result = await Tesseract.recognize(
                currentPhoto,
                'spa+eng', // Español e Inglés
                {
                    logger: info => {
                        if (info.status === 'recognizing text') {
                            const progress = Math.round(info.progress * 100);
                            progressBar.style.width = progress + '%';
                            progressText.textContent = 'Leyendo texto: ' + progress + '%';
                        } else if (info.status === 'loading tesseract core') {
                            progressText.textContent = 'Cargando motor OCR...';
                        } else if (info.status === 'initializing tesseract') {
                            progressText.textContent = 'Inicializando...';
                        }
                    }
                }
            );
            
            const texto = result.data.text;
            console.log('📄 TEXTO COMPLETO EXTRAÍDO:');
            console.log(texto);
            console.log('═══════════════════════════');
            
            const loadingMsg = document.getElementById('loading-ocr');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            // Extraer datos con lógica ULTRA mejorada
            const datos = extraerDatosUltraMejorado(texto);
            
            // Mostrar en consola lo detectado
            console.log('🔍 DATOS DETECTADOS:');
            console.log('Total:', datos.total);
            console.log('Fecha:', datos.fecha);
            console.log('Comercio:', datos.comercio);
            console.log('Producto:', datos.producto);
            console.log('Categoría:', datos.categoria);
            console.log('═══════════════════════════');
            
            let detectados = [];
            let camposCompletos = 0;
            
            if (datos.total) {
                document.getElementById('importe').value = datos.total;
                detectados.push('💰 Total: ' + datos.total + '€');
                camposCompletos++;
            }
            
            if (datos.fecha) {
                if (modoManual) {
                    fechaManual.value = datos.fecha;
                } else {
                    const p = datos.fecha.split('/');
                    if (p.length === 3) {
                        fechaCalendario.value = p[2] + '-' + p[1] + '-' + p[0];
                    }
                }
                detectados.push('📅 Fecha: ' + datos.fecha);
                camposCompletos++;
            }
            
            if (datos.comercio || datos.producto) {
                let conceptoFinal = '';
                
                if (datos.comercio) {
                    conceptoFinal = datos.comercio;
                }
                
                if (datos.producto && datos.producto !== datos.comercio) {
                    if (conceptoFinal) {
                        conceptoFinal += ' - ' + datos.producto;
                    } else {
                        conceptoFinal = datos.producto;
                    }
                }
                
                if (conceptoFinal) {
                    document.getElementById('concepto').value = conceptoFinal;
                    detectados.push('🏪 ' + conceptoFinal);
                    camposCompletos++;
                }
            }
            
            if (datos.categoria) {
                const categoriaSelect = document.getElementById('categoria');
                categoriaSelect.value = datos.categoria;
                detectados.push('📦 Categoría: ' + datos.categoria);
                camposCompletos++;
            }
            
            if (camposCompletos > 0) {
                alert('✅ Detectados ' + camposCompletos + ' de 4 campos:\n\n' + 
                      detectados.join('\n') + '\n\n' +
                      '👀 Revisa los datos y completa lo que falte antes de guardar');
            } else {
                // Mostrar el texto para debug
                alert('⚠️ No se pudieron detectar datos automáticamente.\n\n' +
                      '💡 CONSEJOS:\n' +
                      '• Asegúrate de que la foto esté enfocada\n' +
                      '• Buena iluminación (sin sombras)\n' +
                      '• Ticket recto (no torcido)\n' +
                      '• Texto legible\n\n' +
                      'Introduce los datos manualmente.');
                      
                console.log('⚠️ TEXTO EXTRAÍDO PARA DEBUG:', texto.substring(0, 500));
            }
            
        } catch (error) {
            console.error('❌ Error OCR:', error);
            const loadingMsg = document.getElementById('loading-ocr');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            alert('❌ Error al analizar la factura.\n\n' + 
                  'Introduce los datos manualmente.');
        }
    };
    reader.readAsDataURL(file);
}

// 🧠 EXTRACCIÓN ULTRA MEJORADA
function extraerDatosUltraMejorado(texto) {
    const datos = { 
        total: null, 
        fecha: null, 
        comercio: null, 
        producto: null,
        categoria: null 
    };
    
    // Normalizar texto
    const textoOriginal = texto;
    texto = texto.replace(/\r\n/g, '\n');
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log('📋 Total de líneas:', lineas.length);
    
    // ═══════════════════════════════════════
    // 1. EXTRAER TOTAL - LÓGICA ULTRA MEJORADA
    // ═══════════════════════════════════════
    
    // Estrategia 1: Buscar "TOTAL" con número cerca
    const patronesTotalExacto = [
        /total\s*:?\s*(\d+[.,]\d{2})/gi,
        /total\s+(\d+[.,]\d{2})/gi,
        /total\s*€?\s*(\d+[.,]\d{2})/gi,
        /importe\s*:?\s*(\d+[.,]\d{2})/gi,
        /a\s*pagar\s*:?\s*(\d+[.,]\d{2})/gi,
        /(\d+[.,]\d{2})\s*€\s*total/gi,
        /€\s*(\d+[.,]\d{2})\s*total/gi
    ];
    
    for (let patron of patronesTotalExacto) {
        patron.lastIndex = 0; // Reset regex
        const matches = texto.matchAll(patron);
        for (let match of matches) {
            const numero = match[1].replace(',', '.');
            const valor = parseFloat(numero);
            if (valor > 0 && valor < 10000) {
                datos.total = numero;
                console.log('✅ Total encontrado (método palabras clave):', datos.total);
                break;
            }
        }
        if (datos.total) break;
    }
    
    // Estrategia 2: Buscar en líneas con "TOTAL"
    if (!datos.total) {
        for (let linea of lineas) {
            if (/total|importe|pagar|suma/i.test(linea)) {
                const numeros = linea.match(/\d+[.,]\d{2}/g);
                if (numeros && numeros.length > 0) {
                    // Coger el último número (suele ser el total)
                    const numero = numeros[numeros.length - 1].replace(',', '.');
                    const valor = parseFloat(numero);
                    if (valor > 0 && valor < 10000) {
                        datos.total = numero;
                        console.log('✅ Total encontrado (línea con TOTAL):', datos.total);
                        break;
                    }
                }
            }
        }
    }
    
    // Estrategia 3: Buscar número con € al lado
    if (!datos.total) {
        const patronEuro = /(\d+[.,]\d{2})\s*€/g;
        const matchesEuro = [];
        let match;
        while ((match = patronEuro.exec(texto)) !== null) {
            const numero = match[1].replace(',', '.');
            const valor = parseFloat(numero);
            if (valor > 0 && valor < 10000) {
                matchesEuro.push(valor);
            }
        }
        
        if (matchesEuro.length > 0) {
            // El total suele ser el más grande
            const mayorNumero = Math.max(...matchesEuro);
            datos.total = mayorNumero.toFixed(2);
            console.log('✅ Total encontrado (número más grande con €):', datos.total);
        }
    }
    
    // Estrategia 4: Último número grande de 2 decimales
    if (!datos.total) {
        const todosNumeros = texto.match(/\d+[.,]\d{2}/g);
        if (todosNumeros && todosNumeros.length > 0) {
            const numerosValidos = todosNumeros
                .map(n => parseFloat(n.replace(',', '.')))
                .filter(n => n > 1 && n < 10000)
                .sort((a, b) => b - a);
            
            if (numerosValidos.length > 0) {
                datos.total = numerosValidos[0].toFixed(2);
                console.log('✅ Total encontrado (último número válido):', datos.total);
            }
        }
    }
    
    // ═══════════════════════════════════════
    // 2. EXTRAER FECHA - ULTRA MEJORADO
    // ═══════════════════════════════════════
    
    const patronesFecha = [
        // DD/MM/YYYY
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](20\d{2})/,
        // DD/MM/YY
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})(?!\d)/,
        // Fecha escrita: "12 NOV 2025"
        /(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\s+(20\d{2})/i
    ];
    
    for (let patron of patronesFecha) {
        const match = texto.match(patron);
        if (match) {
            let dia, mes, año;
            
            if (match[2] && isNaN(match[2])) {
                // Fecha con mes en texto
                const meses = {
                    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
                    'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
                    'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
                };
                dia = match[1].padStart(2, '0');
                mes = meses[match[2].toLowerCase().substring(0, 3)];
                año = match[3];
            } else if (match[3] && match[3].length === 4) {
                // DD/MM/YYYY
                dia = match[1].padStart(2, '0');
                mes = match[2].padStart(2, '0');
                año = match[3];
            } else {
                // DD/MM/YY
                dia = match[1].padStart(2, '0');
                mes = match[2].padStart(2, '0');
                año = '20' + match[3];
            }
            
            // Validar
            const diaNum = parseInt(dia);
            const mesNum = parseInt(mes);
            
            if (diaNum >= 1 && diaNum <= 31 && mesNum >= 1 && mesNum <= 12) {
                datos.fecha = dia + '/' + mes + '/' + año;
                console.log('✅ Fecha encontrada:', datos.fecha);
                break;
            }
        }
    }
    
    // ═══════════════════════════════════════
    // 3. EXTRAER COMERCIO - ULTRA MEJORADO
    // ═══════════════════════════════════════
    
    const comerciosConocidos = {
        'mercadona': 'Mercadona',
        'carrefour': 'Carrefour',
        'lidl': 'Lidl',
        'aldi': 'Aldi',
        'dia': 'Dia',
        'eroski': 'Eroski',
        'alcampo': 'Alcampo',
        'amazon': 'Amazon',
        'mediamarkt': 'MediaMarkt',
        'media markt': 'MediaMarkt',
        'worten': 'Worten',
        'fnac': 'Fnac',
        'el corte ingles': 'El Corte Inglés',
        'corte ingles': 'El Corte Inglés',
        'decathlon': 'Decathlon',
        'zara': 'Zara',
        'h&m': 'H&M',
        'mango': 'Mango',
        'primark': 'Primark',
        'ikea': 'Ikea',
        'leroy merlin': 'Leroy Merlin',
        'bricomart': 'Bricomart',
        'telepizza': 'Telepizza',
        'dominos': 'Dominos',
        'mcdonalds': 'McDonalds',
        'mcdonald': 'McDonalds',
        'burger king': 'Burger King',
        'kfc': 'KFC',
        'pccomponentes': 'PcComponentes'
    };
    
    const textoLower = texto.toLowerCase();
    
    // Buscar comercio conocido
    for (let [clave, nombre] of Object.entries(comerciosConocidos)) {
        if (textoLower.includes(clave)) {
            datos.comercio = nombre;
            console.log('✅ Comercio encontrado (conocido):', datos.comercio);
            break;
        }
    }
    
    // Si no encuentra comercio conocido, buscar en primeras 5 líneas
    if (!datos.comercio) {
        for (let i = 0; i < Math.min(5, lineas.length); i++) {
            const linea = lineas[i];
            
            // Buscar líneas mayormente en mayúsculas y con longitud razonable
            const mayusculas = (linea.match(/[A-ZÑÁÉÍÓÚ]/g) || []).length;
            const letras = (linea.match(/[A-Za-zñÑáéíóúÁÉÍÓÚ]/g) || []).length;
            
            if (letras >= 3 && mayusculas >= letras * 0.6 && linea.length >= 3 && linea.length <= 40) {
                // Limpiar la línea
                let comercio = linea
                    .replace(/[^A-Za-zñÑáéíóúÁÉÍÓÚ\s&\-]/g, '')
                    .trim();
                
                if (comercio.length >= 3) {
                    datos.comercio = comercio;
                    console.log('✅ Comercio encontrado (mayúsculas):', datos.comercio);
                    break;
                }
            }
        }
    }
    
    // ═══════════════════════════════════════
    // 4. EXTRAER PRODUCTO - ULTRA MEJORADO
    // ═══════════════════════════════════════
    
    // Buscar después del comercio, antes de los totales
    let inicioProductos = 3;
    let finProductos = Math.min(20, lineas.length);
    
    for (let i = inicioProductos; i < finProductos; i++) {
        const linea = lineas[i];
        
        // Ignorar líneas con keywords de total/subtotal
        if (/total|subtotal|iva|descuento|suma|importe/i.test(linea)) continue;
        
        // Ignorar líneas que solo tienen números y símbolos
        const soloLetras = linea.replace(/[^A-Za-zñÑáéíóúÁÉÍÓÚ]/g, '');
        if (soloLetras.length < 3) continue;
        
        // Ignorar líneas muy cortas o muy largas
        if (linea.length < 3 || linea.length > 60) continue;
        
        // Limpiar y validar
        let producto = linea
            .replace(/\d+[.,]\d{2}/g, '') // Quitar precios
            .replace(/€/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (producto.length >= 4 && producto.length <= 50) {
            datos.producto = producto;
            console.log('✅ Producto encontrado:', datos.producto);
            break;
        }
    }
    
    // Si no hay producto, poner genérico según comercio
    if (!datos.producto && datos.comercio) {
        const comercioLower = datos.comercio.toLowerCase();
        
        if (comercioLower.includes('mercadona') || comercioLower.includes('carrefour') || 
            comercioLower.includes('lidl') || comercioLower.includes('dia') ||
            comercioLower.includes('eroski') || comercioLower.includes('alcampo')) {
            datos.producto = 'Compra';
        } else if (comercioLower.includes('amazon')) {
            datos.producto = 'Pedido';
        } else {
            datos.producto = 'Compra';
        }
    }
    
    // ═══════════════════════════════════════
    // 5. DETECTAR CATEGORÍA
    // ═══════════════════════════════════════
    
    const textoCompleto = (datos.comercio + ' ' + datos.producto + ' ' + texto).toLowerCase();
    
    const categorias = {
        'alimentacion': ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'eroski', 'alcampo', 'supermercado', 'comida', 'aliment'],
        'tecnologia': ['amazon', 'pccomponentes', 'mediamarkt', 'worten', 'fnac', 'iphone', 'samsung', 'xiaomi', 'ordenador', 'portatil', 'movil', 'auriculares'],
        'ropa': ['zara', 'h&m', 'mango', 'primark', 'pull&bear', 'bershka', 'stradivarius', 'ropa', 'camisa', 'pantalon'],
        'hogar': ['ikea', 'leroy merlin', 'bricomart', 'mueble', 'decoracion', 'hogar'],
        'ocio': ['telepizza', 'dominos', 'mcdonalds', 'burger', 'kfc', 'cine', 'restaurante']
    };
    
    for (let [categoria, palabras] of Object.entries(categorias)) {
        for (let palabra of palabras) {
            if (textoCompleto.includes(palabra)) {
                datos.categoria = categoria;
                console.log('✅ Categoría detectada:', datos.categoria);
                break;
            }
        }
        if (datos.categoria) break;
    }
    
    return datos;
}

form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    let fecha, fechaISO;
    if (modoManual) {
        fecha = fechaManual.value;
        const p = fecha.split('/');
        fechaISO = p[2] + '-' + p[1] + '-' + p[0];
    } else {
        fechaISO = fechaCalendario.value;
        const f = new Date(fechaISO);
        fecha = String(f.getDate()).padStart(2, '0') + '/' + 
                String(f.getMonth() + 1).padStart(2, '0') + '/' + 
                f.getFullYear();
    }
    
    let garantiaHasta = '';
    const garantiaTipo = document.getElementById('garantia-tipo').value;
    if (garantiaTipo === 'custom') {
        garantiaHasta = document.getElementById('garantia-custom').value;
    } else if (garantiaTipo) {
        garantiaHasta = calcularGarantia(fechaISO, garantiaTipo);
    }
    
    const invoice = {
        id: Date.now(),
        fecha: fecha,
        importe: parseFloat(document.getElementById('importe').value),
        concepto: document.getElementById('concepto').value,
        categoria: document.getElementById('categoria').value,
        garantia: garantiaHasta,
        garantiaTipo: garantiaTipo,
        photo: currentPhoto,
        timestamp: new Date().toISOString()
    };
    
    invoices.unshift(invoice);
    
    if (guardarFacturas()) {
        form.reset();
        photoPreview.style.display = 'none';
        currentPhoto = null;
        toggleGarantiaPersonalizada();
        renderInvoices();
        alert('✅ Factura guardada correctamente\n\n📊 Total de facturas: ' + invoices.length);
    }
});

function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    let lista = invoices;
    if (searchTerm) {
        lista = invoices.filter(inv => inv.concepto.toLowerCase().includes(searchTerm));
    }
    
    if (lista.length === 0) {
        invoiceList.innerHTML = searchTerm ? 
            '<div class="empty-state">No se encontraron facturas con "' + searchTerm + '"</div>' :
            '<div class="empty-state">No hay facturas guardadas.<br>¡Añade tu primera factura!</div>';
        return;
    }
    
    invoiceList.innerHTML = lista.map(function(inv) {
        let garantiaHTML = '';
        if (inv.garantia) {
            const gFecha = new Date(inv.garantia);
            const dias = Math.floor((gFecha - new Date()) / 86400000);
            if (dias < 0) {
                garantiaHTML = '<div style="color:#999;font-size:0.9em;margin-top:5px">❌ Garantía caducada</div>';
            } else if (dias < 90) {
                garantiaHTML = '<div style="color:#ff6b6b;font-size:0.9em;margin-top:5px">⚠️ Garantía: ' + formatearFecha(inv.garantia) + ' (' + dias + ' días)</div>';
            } else {
                garantiaHTML = '<div style="color:#666;font-size:0.9em;margin-top:5px">⏰ Garantía: ' + formatearFecha(inv.garantia) + '</div>';
            }
        }
        
        let imgHTML = '';
        if (inv.photo) {
            imgHTML = '<img src="' + inv.photo + '" class="invoice-image-preview" onclick="toggleImage(' + inv.id + ')" id="img-p-' + inv.id + '">' +
                     '<img src="' + inv.photo + '" class="invoice-image-full" onclick="toggleImage(' + inv.id + ')" id="img-f-' + inv.id + '" style="display:none">';
        }
        
        return '<div class="invoice-item">' +
            '<div class="invoice-header">' +
                '<div>' +
                    '<div class="invoice-amount">' + inv.importe.toFixed(2) + '€</div>' +
                    '<div class="invoice-details">' + getCategoryEmoji(inv.categoria) + ' ' + inv.categoria + ' • ' + inv.fecha + '</div>' +
                '</div>' +
                '<button class="btn-delete" onclick="deleteInvoice(' + inv.id + ')">🗑️</button>' +
            '</div>' +
            '<div><strong>' + inv.concepto + '</strong></div>' +
            garantiaHTML + imgHTML +
        '</div>';
    }).join('');
}

function toggleImage(id) {
    const p = document.getElementById('img-p-' + id);
    const f = document.getElementById('img-f-' + id);
    if (p && f) {
        if (p.style.display === 'none') {
            p.style.display = 'block';
            f.style.display = 'none';
        } else {
            p.style.display = 'none';
            f.style.display = 'block';
        }
    }
}

function deleteInvoice(id) {
    if (confirm('¿Eliminar esta factura?')) {
        invoices = invoices.filter(inv => inv.id !== id);
        guardarFacturas();
        renderInvoices();
    }
}

function getCategoryEmoji(cat) {
    const e = {alimentacion:'🍔',tecnologia:'📱',electrodomesticos:'⚡',ropa:'👕',hogar:'🏠',transporte:'🚗',suministros:'💡',salud:'🏥',ocio:'🎮',deportes:'🏋️',educacion:'📚',mascotas:'🐾',belleza:'💈',servicios:'🔧',otros:'📦'};
    return e[cat] || '📄';
}

function formatearFecha(iso) {
    if (!iso) return '';
    const f = new Date(iso);
    return String(f.getDate()).padStart(2,'0') + '/' + String(f.getMonth()+1).padStart(2,'0') + '/' + f.getFullYear();
}

cargarFacturas();
renderInvoices();
console.log('✅ Gestor de Facturas PRO iniciado - Versión Ultra Mejorada');
