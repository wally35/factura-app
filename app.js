// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;
let modoManual = false;

// 🔑 SISTEMA ROTATIVO DE API KEYS (pon aquí tus claves de Gemini)
const GEMINI_API_KEYS = [
    'AIzaSyCKdb9YfWi23ZraEQ6PE_MgyEaw9x1s4g8', // Key 1 (actual)
    // 'TU_SEGUNDA_KEY_AQUI',  // Key 2 (descomenta y pon tu segunda key)
    // 'TU_TERCERA_KEY_AQUI',  // Key 3 (descomenta y pon tu tercera key)
];

let currentKeyIndex = parseInt(localStorage.getItem('currentKeyIndex') || '0');

// Función para obtener la siguiente API key
function getNextApiKey() {
    const key = GEMINI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
    localStorage.setItem('currentKeyIndex', currentKeyIndex.toString());
    console.log('🔑 Usando API key #' + (currentKeyIndex === 0 ? GEMINI_API_KEYS.length : currentKeyIndex));
    return key;
}

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
const searchInput = document.getElementById('search-input');

// Buscador de facturas
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        renderInvoices(searchTerm);
    });
}

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

// 🤖 Función para procesar foto con Gemini IA (con reintentos automáticos)
async function procesarFoto(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            currentPhoto = e.target.result;
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
            
            // Mostrar mensaje de análisis
            const mensaje = document.createElement('div');
            mensaje.id = 'loading-ia';
            mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px 30px; border-radius: 10px; z-index: 10000; text-align: center;';
            mensaje.innerHTML = '🤖 Analizando factura con IA...<br><small id="status-text">Conectando...</small>';
            document.body.appendChild(mensaje);
            
            // Intentar con reintentos automáticos
            let intentos = 0;
            let exito = false;
            const maxIntentos = GEMINI_API_KEYS.length;
            
            while (intentos < maxIntentos && !exito) {
                intentos++;
                
                try {
                    document.getElementById('status-text').textContent = 'Intento ' + intentos + ' de ' + maxIntentos + '...';
                    
                    // Convertir imagen a base64
                    const base64Image = currentPhoto.split(',')[1];
                    
                    // Obtener siguiente API key
                    const apiKey = getNextApiKey();
                    
                    // PROMPT MEJORADO
                    const promptMejorado = `Eres un experto analizando facturas españolas.

Analiza y extrae:

1. TOTAL FINAL CON IVA (el importe que pagó el cliente)
2. FECHA (DD/MM/YYYY)
3. COMERCIO (nombre tienda)
4. ARTÍCULO (producto principal)
5. CATEGORÍA (elige UNA):
   - alimentacion: supermercados
   - tecnologia: móviles, tablets, ordenadores
   - electrodomesticos: LAVADORAS, neveras, microondas, aspiradoras
   - ropa: tiendas de moda, ropa, zapatos
   - hogar: muebles, decoración
   - ocio: restaurantes, cine
   - otros: resto

CRÍTICO:
- LAVADORA = electrodomesticos (NO ropa)
- TOTAL = precio CON IVA

Responde SOLO JSON:
{"total":"123.45","fecha":"12/11/2025","comercio":"MediaMarkt","articulo":"Lavadora","categoria":"electrodomesticos"}`;
                    
                    // Llamar a Gemini
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: promptMejorado },
                                    {
                                        inline_data: {
                                            mime_type: 'image/jpeg',
                                            data: base64Image
                                        }
                                    }
                                ]
                            }],
                            generationConfig: {
                                temperature: 0.1,
                                topK: 32,
                                topP: 0.9,
                                maxOutputTokens: 800,
                            }
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('✅ Respuesta de Gemini:', data);
                        
                        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                            const textoRespuesta = data.candidates[0].content.parts[0].text;
                            
                            // Limpiar respuesta
                            let jsonText = textoRespuesta
                                .replace(/```json\n?/g, '')
                                .replace(/```\n?/g, '')
                                .trim();
                            
                            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                jsonText = jsonMatch[0];
                            }
                            
                            try {
                                const datosFactura = JSON.parse(jsonText);
                                let datosDetectados = [];
                                
                                // Rellenar importe
                                if (datosFactura.total && datosFactura.total !== null) {
                                    const importeNumerico = String(datosFactura.total).replace(',', '.');
                                    document.getElementById('importe').value = importeNumerico;
                                    datosDetectados.push('💰 Total: ' + importeNumerico + '€');
                                }
                                
                                // Rellenar fecha
                                if (datosFactura.fecha && datosFactura.fecha !== null) {
                                    if (modoManual) {
                                        fechaManual.value = datosFactura.fecha;
                                    } else {
                                        const partes = datosFactura.fecha.split('/');
                                        if (partes.length === 3) {
                                            const fechaISO = partes[2] + '-' + partes[1] + '-' + partes[0];
                                            fechaCalendario.value = fechaISO;
                                        }
                                    }
                                    datosDetectados.push('📅 Fecha: ' + datosFactura.fecha);
                                }
                                
                                // Rellenar concepto
                                if (datosFactura.comercio || datosFactura.articulo) {
                                    let concepto = '';
                                    if (datosFactura.comercio && datosFactura.comercio !== null) {
                                        concepto = datosFactura.comercio;
                                    }
                                    if (datosFactura.articulo && datosFactura.articulo !== null) {
                                        concepto += (concepto ? ' - ' : '') + datosFactura.articulo;
                                    }
                                    document.getElementById('concepto').value = concepto;
                                    datosDetectados.push('🏪 ' + concepto);
                                }
                                
                                // Rellenar categoría
                                if (datosFactura.categoria && datosFactura.categoria !== null) {
                                    const categoriaSelect = document.getElementById('categoria');
                                    const optionExists = Array.from(categoriaSelect.options).some(opt => opt.value === datosFactura.categoria);
                                    if (optionExists) {
                                        categoriaSelect.value = datosFactura.categoria;
                                        datosDetectados.push('📦 ' + datosFactura.categoria);
                                    }
                                }
                                
                                // Éxito
                                exito = true;
                                
                                const loadingMsg = document.getElementById('loading-ia');
                                if (loadingMsg) {
                                    document.body.removeChild(loadingMsg);
                                }
                                
                                if (datosDetectados.length > 0) {
                                    alert('✅ Datos detectados:\n\n' + datosDetectados.join('\n') + '\n\n👀 Verifica antes de guardar');
                                } else {
                                    alert('⚠️ No se detectaron datos.\nIntrodúcelos manualmente.');
                                }
                                
                            } catch (parseError) {
                                console.error('Error parseando JSON:', parseError);
                                throw new Error('Error procesando respuesta');
                            }
                        } else {
                            throw new Error('Respuesta inválida');
                        }
                    } else if (response.status === 429) {
                        console.log('⚠️ API key bloqueada, rotando a la siguiente...');
                        // Continuar al siguiente intento con otra key
                    } else {
                        throw new Error('Error HTTP: ' + response.status);
                    }
                    
                } catch (error) {
                    console.error('Error intento ' + intentos + ':', error);
                    
                    // Si es el último intento, mostrar error
                    if (intentos >= maxIntentos) {
                        const loadingMsg = document.getElementById('loading-ia');
                        if (loadingMsg) {
                            document.body.removeChild(loadingMsg);
                        }
                        alert('⚠️ No se pudo analizar la factura.\n\nIntroduce los datos manualmente.');
                    }
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
function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    let facturasAMostrar = invoices;
    if (searchTerm) {
        facturasAMostrar = invoices.filter(function(invoice) {
            const concepto = invoice.concepto.toLowerCase();
            return concepto.includes(searchTerm);
        });
    }
    
    if (facturasAMostrar.length === 0) {
        if (searchTerm) {
            invoiceList.innerHTML = '<div class="empty-state">No se encontraron facturas con "' + searchTerm + '"</div>';
        } else {
            invoiceList.innerHTML = '<div class="empty-state">No hay facturas guardadas.<br>¡Añade tu primera factura!</div>';
        }
        return;
    }
    
    invoiceList.innerHTML = facturasAMostrar.map(function(invoice) {
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
        
        let imagenHTML = '';
        if (invoice.photo) {
            imagenHTML = '<img src="' + invoice.photo + '" alt="Factura" class="invoice-image-preview" onclick="toggleImage(' + invoice.id + ')" id="img-preview-' + invoice.id + '">' +
                        '<img src="' + invoice.photo + '" alt="Factura completa" class="invoice-image-full" onclick="toggleImage(' + invoice.id + ')" id="img-full-' + invoice.id + '" style="display: none;">';
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
            imagenHTML +
        '</div>';
    }).join('');
}

function toggleImage(id) {
    const preview = document.getElementById('img-preview-' + id);
    const full = document.getElementById('img-full-' + id);
    
    if (preview && full) {
        if (preview.style.display === 'none') {
            preview.style.display = 'block';
            full.style.display = 'none';
        } else {
            preview.style.display = 'none';
            full.style.display = 'block';
        }
    }
}

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

function getCategoryEmoji(category) {
    const emojis = {
        'alimentacion': '🍔',
        'tecnologia': '📱',
        'electrodomesticos': '⚡',
        'ropa': '👕',
        'hogar': '🏠',
        'transporte': '🚗',
        'suministros': '💡',
        'salud': '🏥',
        'ocio': '🎮',
        'deportes': '🏋️',
        'educacion': '📚',
        'mascotas': '🐾',
        'belleza': '💈',
        'servicios': '🔧',
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
console.log('✅ Sistema rotativo activado con ' + GEMINI_API_KEYS.length + ' API keys');
