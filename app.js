// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;
let modoManual = false;

// Elementos del DOM
const photoCamera = document.getElementById('photo-camera');
const photoGallery = document.getElementById('photo-gallery');
const photoPreview = document.getElementById('photo-preview');
const form = document.getElementById('invoice-form');
const invoiceList = document.getElementById('invoice-list');
const count = document.getElementById('count');
const fechaCalendario = document.getElementById('fecha-calendario');
const fechaManual = document.getElementById('fecha-manual');
const toggleBtn = document.getElementById('toggle-fecha');

// Cambiar entre calendario y manual
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

// Auto-formato de fecha manual
fechaManual.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    
    if (value.length > 0) {
        formatted = value.substring(0, 2);
    }
    if (value.length >= 3) {
        formatted += '/' + value.substring(2, 4);
    }
    if (value.length >= 5) {
        formatted += '/' + value.substring(4, 8);
    }
    
    e.target.value = formatted;
});

// Mostrar/ocultar campo de garantía personalizada
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

// Calcular fecha de garantía
function calcularGarantia(fechaCompra, años) {
    const fecha = new Date(fechaCompra);
    fecha.setFullYear(fecha.getFullYear() + parseInt(años));
    return fecha.toISOString().split('T')[0];
}

// Procesar foto de cámara
photoCamera.addEventListener('change', async function(e) {
    await procesarFoto(e.target.files[0]);
});

// Procesar foto de galería
photoGallery.addEventListener('change', async function(e) {
    await procesarFoto(e.target.files[0]);
});

// Función para procesar foto con Tesseract OCR (100% gratis, sin APIs)
async function procesarFoto(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            currentPhoto = e.target.result;
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
            
            // Mostrar mensaje de análisis
            const mensaje = document.createElement('div');
            mensaje.id = 'loading-ocr';
            mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px 30px; border-radius: 10px; z-index: 10000; text-align: center; min-width: 250px;';
            mensaje.innerHTML = '🔍 Analizando factura...<br><small>Esto puede tardar unos segundos</small><br><div style="margin-top: 10px; font-size: 12px;" id="progress-text">0%</div>';
            document.body.appendChild(mensaje);
            
            try {
                // Usar Tesseract.js para OCR con mejor configuración
                const worker = await Tesseract.createWorker('spa', 1, {
                    logger: m => {
                        const progressElement = document.getElementById('progress-text');
                        if (progressElement) {
                            if (m.status === 'loading tesseract core') {
                                progressElement.textContent = 'Cargando OCR...';
                            } else if (m.status === 'initializing tesseract') {
                                progressElement.textContent = 'Inicializando...';
                            } else if (m.status === 'loading language traineddata') {
                                progressElement.textContent = 'Cargando idioma... ' + Math.round(m.progress * 100) + '%';
                            } else if (m.status === 'initializing api') {
                                progressElement.textContent = 'Preparando...';
                            } else if (m.status === 'recognizing text') {
                                progressElement.textContent = 'Analizando texto... ' + Math.round(m.progress * 100) + '%';
                            }
                        }
                    },
                    errorHandler: err => console.error('Error en Tesseract:', err)
                });
                
                const { data: { text } } = await worker.recognize(currentPhoto);
                await worker.terminate();
                
                console.log('Texto detectado:', text);
                
                // Quitar mensaje de carga
                const loadingMsg = document.getElementById('loading-ocr');
                if (loadingMsg) {
                    document.body.removeChild(loadingMsg);
                }
                
                // Procesar el texto extraído
                let datosDetectados = [];
                
                // 1. Detectar IMPORTE (buscar patrones de precio)
                const regexImporte = /(?:total|importe|amount|precio|price|pagar|pay)[\s:]*[€$]?\s*(\d{1,6}[.,]\d{2})|(\d{1,6}[.,]\d{2})\s*[€$]/gi;
                const matchesImporte = text.matchAll(regexImporte);
                let importes = [];
                for (const match of matchesImporte) {
                    const importe = (match[1] || match[2]).replace(',', '.');
                    importes.push(parseFloat(importe));
                }
                // Usar el importe más alto encontrado
                if (importes.length > 0) {
                    const importeMax = Math.max(...importes).toFixed(2);
                    document.getElementById('importe').value = importeMax;
                    datosDetectados.push('💰 Total: ' + importeMax + '€');
                }
                
                // 2. Detectar FECHA (varios formatos y mejor búsqueda)
                let fechaDetectada = null;
                
                // Patrones de fecha más flexibles
                const patronesFecha = [
                    // DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
                    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g,
                    // DD/MM/YY o DD-MM-YY
                    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/g,
                    // YYYY/MM/DD o YYYY-MM-DD
                    /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g
                ];
                
                // Buscar fecha cerca de palabras clave
                const lineasFecha = text.split('\n');
                for (let i = 0; i < lineasFecha.length; i++) {
                    const linea = lineasFecha[i].toLowerCase();
                    
                    // Si la línea contiene palabras relacionadas con fecha
                    if (linea.match(/fecha|date|emitida|emision|compra/i)) {
                        // Buscar fecha en esta línea y las 2 siguientes
                        const contexto = lineasFecha.slice(i, i + 3).join(' ');
                        
                        for (const patron of patronesFecha) {
                            const match = contexto.match(patron);
                            if (match) {
                                fechaDetectada = match[0];
                                break;
                            }
                        }
                        if (fechaDetectada) break;
                    }
                }
                
                // Si no encontró fecha cerca de palabras clave, buscar cualquier fecha
                if (!fechaDetectada) {
                    for (const patron of patronesFecha) {
                        const match = text.match(patron);
                        if (match) {
                            fechaDetectada = match[0];
                            break;
                        }
                    }
                }
                
                // Procesar la fecha detectada
                if (fechaDetectada) {
                    let dia, mes, año;
                    const separador = fechaDetectada.match(/[\/\-.]/)[0];
                    const partes = fechaDetectada.split(separador);
                    
                    // Determinar formato (DD/MM/YYYY o YYYY/MM/DD)
                    if (partes[0].length === 4) {
                        // Formato YYYY/MM/DD
                        año = partes[0];
                        mes = partes[1].padStart(2, '0');
                        dia = partes[2].padStart(2, '0');
                    } else {
                        // Formato DD/MM/YYYY o DD/MM/YY
                        dia = partes[0].padStart(2, '0');
                        mes = partes[1].padStart(2, '0');
                        año = partes[2];
                        
                        // Si el año es de 2 dígitos, convertir a 4
                        if (año.length === 2) {
                            const añoNum = parseInt(año);
                            // Si es mayor a 50, es 19XX, si no es 20XX
                            año = añoNum > 50 ? '19' + año : '20' + año;
                        }
                    }
                    
                    // Validar que sea una fecha razonable (no en el futuro lejano, no muy antigua)
                    const fechaObj = new Date(año + '-' + mes + '-' + dia);
                    const hoy = new Date();
                    const hace10años = new Date();
                    hace10años.setFullYear(hoy.getFullYear() - 10);
                    
                    if (fechaObj >= hace10años && fechaObj <= hoy) {
                        const fechaFormateada = dia + '/' + mes + '/' + año;
                        
                        if (modoManual) {
                            fechaManual.value = fechaFormateada;
                        } else {
                            fechaCalendario.value = año + '-' + mes + '-' + dia;
                        }
                        datosDetectados.push('📅 Fecha: ' + fechaFormateada);
                    }
                }
                
                // 3. Detectar COMERCIO (buscar nombres comunes o en las primeras líneas)
                const lineas = text.split('\n').filter(l => l.trim().length > 0);
                let posibleComercio = '';
                
                // Palabras que suelen indicar que NO es un comercio
                const palabrasExcluir = /factura|invoice|ticket|recibo|fecha|date|total|importe|precio|price|nif|cif|iva|tax|cantidad|amount|descripcion|description|pagado|paid/i;
                
                // Buscar en las primeras 10 líneas
                for (let i = 0; i < Math.min(lineas.length, 10); i++) {
                    const linea = lineas[i].trim();
                    
                    // Debe tener longitud razonable y no contener palabras a excluir
                    if (linea.length >= 3 && 
                        linea.length <= 60 && 
                        !palabrasExcluir.test(linea) &&
                        !linea.match(/^[\d\s\.,\/\-€$]+$/) && // No solo números/símbolos
                        !linea.match(/^\d/) && // No empieza con número
                        linea.match(/[a-zA-Z]/) // Contiene letras
                    ) {
                        // Limpiar la línea
                        posibleComercio = linea
                            .replace(/\s+/g, ' ') // Normalizar espacios
                            .replace(/[•\*\-]\s*/g, '') // Quitar viñetas
                            .trim();
                        
                        // Si tiene longitud razonable, usar este
                        if (posibleComercio.length >= 3 && posibleComercio.length <= 50) {
                            break;
                        }
                    }
                }
                
                // También buscar cerca de palabras clave
                if (!posibleComercio) {
                    for (let i = 0; i < lineas.length; i++) {
                        const linea = lineas[i].toLowerCase();
                        if (linea.match(/comercio|tienda|empresa|proveedor|vendedor|merchant|store|company/i)) {
                            // Buscar en la línea siguiente
                            if (i + 1 < lineas.length) {
                                const siguienteLinea = lineas[i + 1].trim();
                                if (siguienteLinea.length >= 3 && siguienteLinea.length <= 50 && 
                                    !palabrasExcluir.test(siguienteLinea)) {
                                    posibleComercio = siguienteLinea;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                if (posibleComercio) {
                    document.getElementById('concepto').value = posibleComercio;
                    datosDetectados.push('🏪 Comercio: ' + posibleComercio);
                }
                
                // Mostrar resultados
                if (datosDetectados.length > 0) {
                    alert('✅ Datos detectados:\n\n' + datosDetectados.join('\n') + '\n\n⚠️ Revisa que todo sea correcto antes de guardar.');
                } else {
                    alert('⚠️ No se pudieron detectar datos automáticamente.\nPuedes introducirlos manualmente.');
                }
                
            } catch (error) {
                console.error('Error en OCR:', error);
                const loadingMsg = document.getElementById('loading-ocr');
                if (loadingMsg) {
                    document.body.removeChild(loadingMsg);
                }
                
                // Mensajes de error más específicos
                if (error.message && error.message.includes('network')) {
                    alert('❌ Error de conexión.\n\nTesseract necesita descargar archivos la primera vez.\nVerifica tu conexión a internet e intenta de nuevo.\n\nPor ahora, introduce los datos manualmente.');
                } else if (error.message && error.message.includes('timeout')) {
                    alert('⏱️ Tiempo de espera agotado.\n\nLa conexión está muy lenta.\nIntroduce los datos manualmente.');
                } else {
                    alert('❌ Error al analizar la imagen.\n\nPuede ser que:\n• La imagen esté borrosa\n• No haya texto legible\n• Problemas de conexión\n\nIntroduce los datos manualmente.');
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

// Guardar factura
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Obtener fecha
    let fecha;
    let fechaISO;
    if (modoManual) {
        fecha = fechaManual.value;
        // Convertir dd/mm/yyyy a ISO
        const partes = fecha.split('/');
        fechaISO = partes[2] + '-' + partes[1] + '-' + partes[0];
    } else {
        fechaISO = fechaCalendario.value;
        const fechaObj = new Date(fechaISO);
        const dia = String(fechaObj.getDate()).padStart(2, '0');
        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const año = fechaObj.getFullYear();
        fecha = dia + '/' + mes + '/' + año;
    }
    
    // Calcular garantía
    let garantiaHasta = '';
    const garantiaTipo = document.getElementById('garantia-tipo').value;
    
    if (garantiaTipo === 'custom') {
        garantiaHasta = document.getElementById('garantia-custom').value;
    } else if (garantiaTipo !== '') {
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
    localStorage.setItem('invoices', JSON.stringify(invoices));
    
    form.reset();
    photoPreview.style.display = 'none';
    currentPhoto = null;
    toggleGarantiaPersonalizada();
    
    renderInvoices();
    alert('✅ Factura guardada correctamente');
});

// Mostrar facturas
function renderInvoices() {
    count.textContent = invoices.length;
    
    if (invoices.length === 0) {
        invoiceList.innerHTML = '<div class="empty-state">No hay facturas guardadas.<br>¡Añade tu primera factura!</div>';
        return;
    }
    
    invoiceList.innerHTML = invoices.map(function(invoice) {
        let garantiaHTML = '';
        if (invoice.garantia) {
            const garantiaFecha = new Date(invoice.garantia);
            const hoy = new Date();
            const diasRestantes = Math.floor((garantiaFecha - hoy) / (1000 * 60 * 60 * 24));
            
            let garantiaColor = '#666';
            let garantiaIcono = '⏰';
            
            if (diasRestantes < 0) {
                garantiaColor = '#999';
                garantiaIcono = '❌';
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía caducada</div>';
            } else if (diasRestantes < 90) {
                garantiaColor = '#ff6b6b';
                garantiaIcono = '⚠️';
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía hasta: ' + formatearFecha(invoice.garantia) + ' (' + diasRestantes + ' días)</div>';
            } else {
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía hasta: ' + formatearFecha(invoice.garantia) + '</div>';
            }
        }
        
        return '<div class="invoice-item">' +
            '<div class="invoice-header">' +
                '<div>' +
                    '<div class="invoice-amount">' + invoice.importe.toFixed(2) + '€</div>' +
                    '<div class="invoice-details">' +
                        getCategoryEmoji(invoice.categoria) + ' ' + (invoice.categoria || 'Sin categoría') + ' • ' + invoice.fecha +
                    '</div>' +
                '</div>' +
                '<button class="btn-delete" onclick="deleteInvoice(' + invoice.id + ')">🗑️</button>' +
            '</div>' +
            '<div><strong>' + invoice.concepto + '</strong></div>' +
            garantiaHTML +
            (invoice.photo ? '<img src="' + invoice.photo + '" alt="Factura">' : '') +
        '</div>';
    }).join('');
}

// Eliminar factura
function deleteInvoice(id) {
    var confirmado = confirm('¿Eliminar esta factura?');
    if (confirmado) {
        invoices = invoices.filter(function(inv) { 
            return inv.id !== id; 
        });
        localStorage.setItem('invoices', JSON.stringify(invoices));
        renderInvoices();
    }
}

// Utilidades
function getCategoryEmoji(category) {
    const emojis = {
        'electrodomesticos': '⚡',
        'alimentacion': '🍔',
        'transporte': '🚗',
        'suministros': '💡',
        'otros': '📦'
    };
    return emojis[category] || '📄';
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    return dia + '/' + mes + '/' + año;
}

// Cargar facturas al inicio
renderInvoices();
