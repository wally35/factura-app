// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;
let modoManual = false;

// Gemini API Key
const GEMINI_API_KEY = 'AIzaSyCKdb9YfWi23ZraEQ6PE_MgyEaw9x1s4g8';

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

// Función para procesar foto con Gemini IA
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
            mensaje.innerHTML = '🤖 Analizando factura con IA...<br><small>Esto puede tardar unos segundos</small>';
            document.body.appendChild(mensaje);
            
            try {
                // Convertir imagen a base64
                const base64Image = currentPhoto.split(',')[1];
                
                // Llamar a Gemini AI
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    text: 'Eres un experto en análisis de facturas. Analiza esta factura/ticket y extrae los datos más importantes.\n\nINSTRUCCIONES CRÍTICAS:\n1. Busca el TOTAL FINAL A PAGAR (el precio más grande, el que está al final, con IVA incluido)\n2. Para la fecha, busca "Fecha de factura", "Fecha", "Date" o similar\n3. Para el comercio, busca el nombre de la tienda/empresa (Amazon, MediaMarkt, Mercadona, etc.)\n4. Para el artículo, extrae el producto principal (si hay varios, el primero o el más importante)\n5. Clasifica en una de estas categorías: alimentacion, tecnologia, electrodomesticos, ropa, hogar, transporte, suministros, salud, ocio, deportes, educacion, mascotas, belleza, servicios, otros\n\nResponde ÚNICAMENTE con este JSON (sin markdown, sin ```json, sin explicaciones):\n\n{\n  "total": "18.04",\n  "fecha": "11/10/2025",\n  "comercio": "Amazon",\n  "articulo": "Organizador de cables",\n  "categoria": "hogar"\n}\n\nSi no encuentras algún dato, usa null. IMPORTANTE: Responde SOLO el JSON, nada más.'
                                },
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
                            topP: 1,
                            maxOutputTokens: 500,
                        }
                    })
                });
                
                // Quitar mensaje de carga
                const loadingMsg = document.getElementById('loading-ia');
                if (loadingMsg) {
                    document.body.removeChild(loadingMsg);
                }
                
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Respuesta completa de Gemini:', data);
                
                if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                    const textoRespuesta = data.candidates[0].content.parts[0].text;
                    console.log('Texto extraído:', textoRespuesta);
                    
                    // Limpiar la respuesta (quitar markdown)
                    let jsonText = textoRespuesta
                        .replace(/```json\n?/g, '')
                        .replace(/```\n?/g, '')
                        .trim();
                    
                    // Si empieza con texto, buscar el JSON
                    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        jsonText = jsonMatch[0];
                    }
                    
                    console.log('JSON limpio:', jsonText);
                    
                    try {
                        const datosFactura = JSON.parse(jsonText);
                        let datosDetectados = [];
                        
                        // Validar que el JSON tenga la estructura esperada
                        if (!datosFactura || typeof datosFactura !== 'object') {
                            throw new Error('Respuesta no válida');
                        }
                        
                        // Rellenar importe
                        if (datosFactura.total && datosFactura.total !== null) {
                            const importeNumerico = String(datosFactura.total).replace(',', '.');
                            document.getElementById('importe').value = importeNumerico;
                            datosDetectados.push('💰 Total: ' + importeNumerico + '€');
                        }
                        
                        // Rellenar fecha
                        let fechaISO = '';
                        if (datosFactura.fecha && datosFactura.fecha !== null) {
                            if (modoManual) {
                                fechaManual.value = datosFactura.fecha;
                            } else {
                                // Convertir dd/mm/yyyy a yyyy-mm-dd
                                const partes = datosFactura.fecha.split('/');
                                if (partes.length === 3) {
                                    fechaISO = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                                    fechaCalendario.value = fechaISO;
                                }
                            }
                            datosDetectados.push('📅 Fecha: ' + datosFactura.fecha);
                        }
                        
                        // Rellenar concepto/comercio y artículo
                        let conceptoFinal = '';
                        
                        if (datosFactura.comercio && datosFactura.comercio !== null) {
                            conceptoFinal = datosFactura.comercio;
                            datosDetectados.push('🏪 Comercio: ' + datosFactura.comercio);
                        }
                        
                        if (datosFactura.articulo && datosFactura.articulo !== null) {
                            if (conceptoFinal) {
                                conceptoFinal += ' - ' + datosFactura.articulo;
                            } else {
                                conceptoFinal = datosFactura.articulo;
                            }
                            datosDetectados.push('📦 Artículo: ' + datosFactura.articulo);
                        }
                        
                        if (conceptoFinal) {
                            document.getElementById('concepto').value = conceptoFinal;
                        }
                        
                        // Rellenar categoría automáticamente
                        if (datosFactura.categoria && datosFactura.categoria !== null) {
                            const categoriaSelect = document.getElementById('categoria');
                            // Verificar que la categoría existe en el select
                            const opcionCategoria = Array.from(categoriaSelect.options).find(
                                option => option.value === datosFactura.categoria
                            );
                            if (opcionCategoria) {
                                categoriaSelect.value = datosFactura.categoria;
                                datosDetectados.push('📦 Categoría: ' + datosFactura.categoria);
                            }
                        }
                        
                        // ✨ NUEVO: Asignar garantía automática si es Electrónica o Electrodomésticos
                        const garantiaSelect = document.getElementById('garantia-tipo');
                        if (datosFactura.categoria === 'tecnologia' || datosFactura.categoria === 'electrodomesticos') {
                            garantiaSelect.value = '3';
                            datosDetectados.push('✅ Garantía legal: 3 años (automática)');
                        } else {
                            // Para otros productos, dejar sin garantía
                            garantiaSelect.value = '';
                        }
                        
                        if (datosDetectados.length > 0) {
                            alert('✅ Datos detectados con IA:\n\n' + datosDetectados.join('\n') + '\n\n⚠️ Revisa que todo sea correcto antes de guardar.');
                        } else {
                            alert('⚠️ La IA detectó la factura pero no pudo extraer datos específicos.\nIntroduce los datos manualmente.');
                        }
                        
                    } catch (parseError) {
                        console.error('Error al parsear JSON:', parseError);
                        console.error('Texto recibido:', jsonText);
                        
                        // Intentar extraer al menos algunos datos básicos
                        let mensajeError = '⚠️ La IA tuvo problemas al extraer los datos.\n\n';
                        mensajeError += 'Respuesta recibida:\n' + jsonText.substring(0, 200);
                        mensajeError += '\n\nPor favor, introduce los datos manualmente.';
                        alert(mensajeError);
                    }
                } else {
                    console.error('Respuesta inesperada:', data);
                    alert('❌ No se pudo analizar la factura.\nIntroduce los datos manualmente.');
                }
                
            } catch (error) {
                // Quitar mensaje de carga si aún está
                const mensajeExistente = document.getElementById('loading-ia');
                if (mensajeExistente) {
                    document.body.removeChild(mensajeExistente);
                }
                
                console.error('Error completo al procesar con Gemini:', error);
                
                if (error.message.includes('429')) {
                    alert('⚠️ Límite de solicitudes excedido.\nEspera unos minutos e intenta de nuevo, o introduce los datos manualmente.');
                } else if (error.message.includes('403') || error.message.includes('401')) {
                    alert('⚠️ Problema con la API key de Gemini.\nIntroduce los datos manualmente por ahora.');
                } else {
                    alert('❌ Error al conectar con la IA.\nVerifica tu conexión e intenta de nuevo, o introduce los datos manualmente.');
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
function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    // Filtrar facturas según búsqueda
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
            let garantiaTexto = '';
            
            // Determinar si es garantía legal (3 años) o personalizada
            const esGarantiaLegal = (invoice.categoria === 'tecnologia' || invoice.categoria === 'electrodomesticos') && invoice.garantiaTipo === '3';
            
            if (diasRestantes < 0) {
                garantiaColor = '#999';
                garantiaIcono = '❌';
                garantiaTexto = 'Garantía caducada';
            } else if (diasRestantes < 90) {
                garantiaColor = '#ff6b6b';
                garantiaIcono = '⚠️';
                garantiaTexto = 'Garantía hasta: ' + formatearFecha(invoice.garantia) + ' (' + diasRestantes + ' días)';
            } else {
                garantiaTexto = 'Garantía hasta: ' + formatearFecha(invoice.garantia);
            }
            
            // Añadir etiqueta si es garantía legal
            if (esGarantiaLegal && diasRestantes >= 0) {
                garantiaTexto += ' 🇪🇸 Legal';
            }
            
            garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' ' + garantiaTexto + '</div>';
        }
        
        // Generar HTML para imagen (miniatura que se expande)
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

// Toggle de imagen (expandir/contraer)
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
