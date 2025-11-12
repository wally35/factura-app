// 📱 GESTOR DE FACTURAS PRO - Versión Optimizada
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
            if (width > 1000) {
                height = (height * 1000) / width;
                width = 1000;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
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

// 🔍 PROCESAR FOTO CON OCR INTELIGENTE
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
        mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 10px; z-index: 10000; text-align: center; max-width: 300px;';
        mensaje.innerHTML = '🤖 Analizando factura...<br><br><small>Esto puede tardar unos segundos</small><br><br><div id="progress-text" style="margin-top:10px; font-size:12px;">Iniciando...</div>';
        document.body.appendChild(mensaje);
        
        try {
            const progressText = document.getElementById('progress-text');
            
            // OCR con Tesseract
            const result = await Tesseract.recognize(
                currentPhoto,
                'spa+eng', // Español e Inglés
                {
                    logger: info => {
                        if (info.status === 'recognizing text') {
                            const progress = Math.round(info.progress * 100);
                            progressText.textContent = 'Procesando: ' + progress + '%';
                        }
                    }
                }
            );
            
            const texto = result.data.text;
            console.log('📄 Texto extraído:', texto);
            
            const loadingMsg = document.getElementById('loading-ocr');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            // Extraer datos mejorado
            const datos = extraerDatosInteligente(texto);
            
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
            
            if (datos.comercio) {
                let conceptoFinal = datos.comercio;
                
                // Si encontramos producto, agregarlo
                if (datos.producto && datos.producto.toLowerCase() !== datos.comercio.toLowerCase()) {
                    conceptoFinal += ' - ' + datos.producto;
                }
                
                document.getElementById('concepto').value = conceptoFinal;
                detectados.push('🏪 ' + conceptoFinal);
                camposCompletos++;
            }
            
            if (datos.categoria) {
                const categoriaSelect = document.getElementById('categoria');
                categoriaSelect.value = datos.categoria;
                detectados.push('📦 ' + datos.categoria);
                camposCompletos++;
            }
            
            if (camposCompletos > 0) {
                alert('✅ Detectados ' + camposCompletos + ' campos:\n\n' + 
                      detectados.join('\n') + '\n\n' +
                      '👀 Revisa y completa los datos que falten');
            } else {
                alert('⚠️ No se pudieron detectar datos claros.\n\n' +
                      'Por favor, introduce los datos manualmente.\n\n' +
                      '💡 Consejo: Asegúrate de que la foto esté bien enfocada y con buena iluminación.');
            }
            
        } catch (error) {
            console.error('Error OCR:', error);
            const loadingMsg = document.getElementById('loading-ocr');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            alert('❌ Error al analizar la factura.\n\n' + 
                  'Introduce los datos manualmente.');
        }
    };
    reader.readAsDataURL(file);
}

// 🧠 EXTRACCIÓN INTELIGENTE DE DATOS
function extraerDatosInteligente(texto) {
    const datos = { 
        total: null, 
        fecha: null, 
        comercio: null, 
        producto: null,
        categoria: null 
    };
    
    // Limpiar texto
    texto = texto.replace(/\s+/g, ' ').trim();
    
    // ═══════════════════════════════════════
    // 1. EXTRAER TOTAL (mejorado)
    // ═══════════════════════════════════════
    
    // Buscar con palabras clave
    const patronesTotal = [
        /(?:total|importe|amount|suma|pagar|cobrar|a\s*pagar|total\s*a\s*pagar)[:\s]*€?\s*(\d+[.,]\d{2})/gi,
        /(?:total|importe)[:\s]*(\d+[.,]\d{2})\s*€/gi,
        /€\s*(\d+[.,]\d{2})/gi
    ];
    
    for (let patron of patronesTotal) {
        const match = texto.match(patron);
        if (match) {
            const numero = match[match.length - 1].match(/(\d+[.,]\d{2})/);
            if (numero) {
                datos.total = numero[0].replace(',', '.');
                break;
            }
        }
    }
    
    // Si no encuentra, buscar el número más grande con 2 decimales
    if (!datos.total) {
        const numeros = texto.match(/\d+[.,]\d{2}/g);
        if (numeros && numeros.length > 0) {
            const numerosOrdenados = numeros
                .map(n => parseFloat(n.replace(',', '.')))
                .filter(n => n > 0 && n < 100000)
                .sort((a, b) => b - a);
            if (numerosOrdenados.length > 0) {
                datos.total = numerosOrdenados[0].toFixed(2);
            }
        }
    }
    
    // ═══════════════════════════════════════
    // 2. EXTRAER FECHA (mejorado)
    // ═══════════════════════════════════════
    
    const patronesFecha = [
        // DD/MM/YYYY o DD-MM-YYYY
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/,
        // DD/MM/YY
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/,
        // YYYY-MM-DD (ISO)
        /(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    ];
    
    for (let patron of patronesFecha) {
        const match = texto.match(patron);
        if (match) {
            let dia, mes, año;
            
            if (match[3] && match[3].length === 4) {
                // Formato DD/MM/YYYY
                dia = match[1].padStart(2, '0');
                mes = match[2].padStart(2, '0');
                año = match[3];
            } else if (match[1] && match[1].length === 4) {
                // Formato YYYY-MM-DD
                año = match[1];
                mes = match[2].padStart(2, '0');
                dia = match[3].padStart(2, '0');
            } else {
                // Formato DD/MM/YY
                dia = match[1].padStart(2, '0');
                mes = match[2].padStart(2, '0');
                año = '20' + match[3];
            }
            
            // Validar fecha
            const diaNum = parseInt(dia);
            const mesNum = parseInt(mes);
            
            if (diaNum >= 1 && diaNum <= 31 && mesNum >= 1 && mesNum <= 12) {
                datos.fecha = dia + '/' + mes + '/' + año;
                break;
            }
        }
    }
    
    // ═══════════════════════════════════════
    // 3. EXTRAER COMERCIO (mejorado)
    // ═══════════════════════════════════════
    
    const lineas = texto.split(/[\n\r]+/).filter(l => l.trim().length > 2);
    
    // Lista de comercios conocidos
    const comerciosConocidos = [
        'mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'eroski', 'alcampo',
        'amazon', 'ebay', 'aliexpress', 'pccomponentes',
        'mediamarkt', 'worten', 'fnac', 'el corte ingles', 'decathlon',
        'zara', 'h&m', 'mango', 'primark', 'pull&bear',
        'ikea', 'leroy merlin', 'bricomart',
        'mc donald', 'burger king', 'kfc', 'telepizza', 'dominos'
    ];
    
    // Buscar en las primeras 10 líneas
    for (let i = 0; i < Math.min(10, lineas.length); i++) {
        const linea = lineas[i].trim().toLowerCase();
        
        // Buscar comercio conocido
        for (let comercio of comerciosConocidos) {
            if (linea.includes(comercio)) {
                datos.comercio = capitalizar(comercio);
                break;
            }
        }
        
        if (datos.comercio) break;
        
        // Si no, buscar líneas en mayúsculas
        const lineaOriginal = lineas[i].trim();
        const mayusculas = lineaOriginal.replace(/[^A-ZÑ]/g, '').length;
        const totalCaracteres = lineaOriginal.replace(/[^A-ZÑa-zñ]/g, '').length;
        
        if (totalCaracteres > 3 && mayusculas > totalCaracteres * 0.6) {
            datos.comercio = lineaOriginal;
            break;
        }
    }
    
    // ═══════════════════════════════════════
    // 4. EXTRAER PRODUCTO (mejorado)
    // ═══════════════════════════════════════
    
    // Buscar líneas de producto (después del comercio, antes del total)
    if (lineas.length > 3) {
        for (let i = 2; i < Math.min(15, lineas.length); i++) {
            const linea = lineas[i].trim();
            
            // Ignorar líneas con números de total
            if (linea.match(/total|importe|subtotal/i)) continue;
            if (linea.match(/\d+[.,]\d{2}\s*€/)) continue;
            
            // Buscar líneas descriptivas (entre 5 y 50 caracteres)
            if (linea.length >= 5 && linea.length <= 50) {
                // Limpiar caracteres raros
                let producto = linea
                    .replace(/[^\wáéíóúñÁÉÍÓÚÑ\s\-]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                if (producto.length >= 5) {
                    datos.producto = producto;
                    break;
                }
            }
        }
    }
    
    // Si no hay producto específico, usar genérico según comercio
    if (!datos.producto && datos.comercio) {
        const comercioLower = datos.comercio.toLowerCase();
        
        if (comercioLower.includes('mercadona') || comercioLower.includes('carrefour') || 
            comercioLower.includes('lidl') || comercioLower.includes('dia')) {
            datos.producto = 'Compra';
        } else if (comercioLower.includes('amazon') || comercioLower.includes('ebay')) {
            datos.producto = 'Pedido online';
        } else if (comercioLower.includes('mediamarkt') || comercioLower.includes('worten')) {
            datos.producto = 'Electrónica';
        } else {
            datos.producto = 'Compra';
        }
    }
    
    // ═══════════════════════════════════════
    // 5. DETECTAR CATEGORÍA (inteligente)
    // ═══════════════════════════════════════
    
    const textoCompleto = (datos.comercio + ' ' + datos.producto + ' ' + texto).toLowerCase();
    
    const categorias = {
        'alimentacion': ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'eroski', 'comida', 'aliment', 'supermercado'],
        'tecnologia': ['amazon', 'pccomponentes', 'iphone', 'samsung', 'xiaomi', 'ordenador', 'portatil', 'movil', 'tablet', 'auriculares'],
        'electrodomesticos': ['mediamarkt', 'worten', 'lavadora', 'frigorifico', 'microondas', 'aspiradora', 'electrodomestico'],
        'ropa': ['zara', 'h&m', 'mango', 'primark', 'pull&bear', 'bershka', 'camisa', 'pantalon', 'vestido', 'ropa'],
        'hogar': ['ikea', 'leroy merlin', 'mueble', 'decoracion', 'hogar', 'casa'],
        'transporte': ['gasolina', 'diesel', 'repsol', 'cepsa', 'bp', 'combustible', 'taxi', 'uber', 'cabify'],
        'ocio': ['cine', 'teatro', 'concierto', 'entrada', 'tickets', 'ocio'],
        'salud': ['farmacia', 'medicamento', 'parafarmacia', 'salud', 'medico']
    };
    
    for (let [categoria, palabrasClave] of Object.entries(categorias)) {
        for (let palabra of palabrasClave) {
            if (textoCompleto.includes(palabra)) {
                datos.categoria = categoria;
                break;
            }
        }
        if (datos.categoria) break;
    }
    
    return datos;
}

function capitalizar(texto) {
    return texto.split(' ').map(palabra => 
        palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    ).join(' ');
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
console.log('✅ Gestor de Facturas PRO iniciado');
