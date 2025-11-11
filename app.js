// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;
let modoManual = false;

// Gemini API Key
const GEMINI_API_KEY = 'AIzaSyCKdb9YfWi23ZraEQ6PE_MgyEaw9x1s4g8';

// Google Drive API
const GOOGLE_CLIENT_ID = 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com'; // ⬅️ CAMBIAR ESTO
const GOOGLE_API_KEY = 'TU_API_KEY_AQUI'; // ⬅️ CAMBIAR ESTO (opcional)
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

let googleAccessToken = null;

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

// Menú
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const menuPanel = document.getElementById('menu-panel');
const menuClose = document.getElementById('menu-close');

// Abrir/cerrar menú
if (menuBtn && menuOverlay && menuPanel) {
    menuBtn.addEventListener('click', function() {
        menuOverlay.classList.add('active');
        menuPanel.classList.add('active');
    });
    
    menuClose.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);
}

function closeMenu() {
    if (menuOverlay && menuPanel) {
        menuOverlay.classList.remove('active');
        menuPanel.classList.remove('active');
    }
}

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
        const input = garantiaCustom.querySelector('input');
        if (input) input.setAttribute('required', '');
    } else {
        garantiaCustom.style.display = 'none';
        const input = garantiaCustom.querySelector('input');
        if (input) input.removeAttribute('required');
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
    if (!file) return;
    
    // Comprimir imagen primero
    const reader = new FileReader();
    reader.onload = async function(e) {
        // Crear imagen para comprimir
        const img = new Image();
        img.onload = async function() {
            // Comprimir a máximo 800px
            let width = img.width;
            let height = img.height;
            const maxSize = 800;
            
            if (width > height && width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            } else if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
            
            // Crear canvas para comprimir
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convertir a base64 comprimido
            currentPhoto = canvas.toDataURL('image/jpeg', 0.7);
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
            
            // Mostrar mensaje de análisis
            const mensaje = document.createElement('div');
            mensaje.id = 'loading-ia';
            mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px 30px; border-radius: 10px; z-index: 10000; text-align: center;';
            mensaje.innerHTML = '🤖 Analizando factura con IA...<br><small>Esto puede tardar unos segundos</small>';
            document.body.appendChild(mensaje);
            
            try {
                const base64Image = currentPhoto.split(',')[1];
                
                console.log('📤 Enviando imagen a Gemini... Tamaño:', Math.round(base64Image.length / 1024), 'KB');
                
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    text: `Analiza esta factura/ticket y extrae EXACTAMENTE estos datos en formato JSON.

IMPORTANTE: Tickets de supermercado, gasolineras, restaurantes, etc. también son válidos.

EXTRAE:
1. TOTAL: Importe final (el número más grande, con IVA)
2. FECHA: Formato DD/MM/YYYY
3. COMERCIO: Nombre de la tienda (Mercadona, Repsol, Amazon, etc.)
4. ARTÍCULOS: Array con TODOS los productos. Si no se distinguen productos individuales, pon ["Compra general"]
5. CATEGORÍA: alimentacion, tecnologia, electrodomesticos, ropa, hogar, transporte, suministros, salud, ocio, deportes, educacion, mascotas, belleza, servicios, otros

Responde SOLO con JSON (sin markdown):
{
  "total": "45.67",
  "fecha": "10/11/2025",
  "comercio": "Mercadona",
  "articulos": ["Compra semanal"],
  "categoria": "alimentacion"
}

Si no encuentras algo, usa null o [].`
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
                            maxOutputTokens: 500,
                        }
                    })
                });
                
                const loadingMsg = document.getElementById('loading-ia');
                if (loadingMsg) document.body.removeChild(loadingMsg);
                
                console.log('📥 Respuesta recibida:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Error de API:', errorText);
                    throw new Error(`Error: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Datos recibidos:', data);
                
                if (data.candidates && data.candidates[0].content) {
                    const texto = data.candidates[0].content.parts[0].text;
                    let jsonText = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) jsonText = jsonMatch[0];
                    
                    const datosFactura = JSON.parse(jsonText);
                    let datosDetectados = [];
                    
                    // Rellenar campos
                    if (datosFactura.total) {
                        document.getElementById('importe').value = String(datosFactura.total).replace(',', '.');
                        datosDetectados.push('💰 Total: ' + datosFactura.total + '€');
                    }
                    
                    if (datosFactura.fecha) {
                        const partes = datosFactura.fecha.split('/');
                        if (partes.length === 3) {
                            fechaCalendario.value = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                            datosDetectados.push('📅 Fecha: ' + datosFactura.fecha);
                        }
                    }
                    
                    if (datosFactura.comercio) {
                        document.getElementById('comercio').value = datosFactura.comercio;
                        datosDetectados.push('🏪 Comercio: ' + datosFactura.comercio);
                    }
                    
                    if (datosFactura.articulos && datosFactura.articulos.length > 0) {
                        document.getElementById('articulos').value = datosFactura.articulos.join(', ');
                        datosDetectados.push('📦 Artículos detectados');
                    }
                    
                    if (datosFactura.categoria) {
                        document.getElementById('categoria').value = datosFactura.categoria;
                        
                        // Garantía automática
                        if (datosFactura.categoria === 'tecnologia' || datosFactura.categoria === 'electrodomesticos') {
                            document.getElementById('garantia-tipo').value = '3';
                            datosDetectados.push('✅ Garantía: 3 años 🇪🇸');
                        }
                    }
                    
                    if (datosDetectados.length > 0) {
                        alert('✅ Datos detectados:\n\n' + datosDetectados.join('\n'));
                    } else {
                        alert('⚠️ No se detectaron datos. Introdúcelos manualmente.');
                    }
                } else {
                    console.error('⚠️ Respuesta sin contenido:', data);
                    alert('⚠️ No se pudo leer la respuesta de la IA.');
                }
                
            } catch (error) {
                const loadingMsg = document.getElementById('loading-ia');
                if (loadingMsg) document.body.removeChild(loadingMsg);
                
                console.error('❌ Error completo:', error);
                alert('❌ Error al analizar: ' + error.message + '\n\nIntroduce los datos manualmente.');
            }
        };
        
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

// Guardar factura
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    try {
        // Obtener fecha
        let fecha, fechaISO;
        if (modoManual) {
            fecha = fechaManual.value;
            if (!fecha || fecha.length < 10) {
                alert('❌ Formato de fecha incorrecto. Usa DD/MM/AAAA');
                return;
            }
            const partes = fecha.split('/');
            fechaISO = `${partes[2]}-${partes[1]}-${partes[0]}`;
        } else {
            fechaISO = fechaCalendario.value;
            if (!fechaISO) {
                alert('❌ Debes seleccionar una fecha');
                return;
            }
            const fechaObj = new Date(fechaISO);
            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            fecha = `${dia}/${mes}/${fechaObj.getFullYear()}`;
        }
        
        // Calcular garantía
        let garantiaHasta = '';
        const garantiaTipo = document.getElementById('garantia-tipo').value;
        
        if (garantiaTipo === 'custom') {
            garantiaHasta = document.getElementById('garantia-custom-date').value;
        } else if (garantiaTipo) {
            garantiaHasta = calcularGarantia(fechaISO, garantiaTipo);
        }
        
        // Garantía extendida
        const garantiaExtNombre = document.getElementById('garantia-ext-nombre').value;
        const garantiaExtAnos = document.getElementById('garantia-ext-anos').value;
        let garantiaExtVence = '';
        
        if (garantiaExtAnos && parseInt(garantiaExtAnos) > 0) {
            const añosTotal = (parseInt(garantiaTipo) || 0) + parseInt(garantiaExtAnos);
            garantiaExtVence = calcularGarantia(fechaISO, añosTotal);
        }
        
        // Artículos
        const articulosTexto = document.getElementById('articulos').value || '';
        const articulosArray = articulosTexto.split(',').map(art => art.trim()).filter(art => art.length > 0);
        
        // Crear factura
        const invoice = {
            id: Date.now(),
            fecha: fecha,
            importe: parseFloat(document.getElementById('importe').value) || 0,
            comercio: document.getElementById('comercio').value || 'Sin comercio',
            articulos: articulosArray,
            categoria: document.getElementById('categoria').value || 'otros',
            garantia: garantiaHasta,
            garantiaTipo: garantiaTipo,
            garantiaExtendida: garantiaExtNombre || null,
            garantiaExtAnos: garantiaExtAnos ? parseInt(garantiaExtAnos) : 0,
            garantiaExtVence: garantiaExtVence || null,
            photo: currentPhoto,
            timestamp: new Date().toISOString()
        };
        
        invoices.unshift(invoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));
        
        // Limpiar formulario
        form.reset();
        photoPreview.style.display = 'none';
        currentPhoto = null;
        toggleGarantiaPersonalizada();
        
        renderInvoices();
        alert('✅ Factura guardada');
        
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('❌ Error al guardar la factura. Revisa los datos.');
    }
});

// Mostrar facturas
function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    let facturasAMostrar = invoices;
    if (searchTerm) {
        facturasAMostrar = invoices.filter(function(invoice) {
            const texto = [
                invoice.comercio || '',
                (invoice.articulos || []).join(' '),
                invoice.concepto || ''
            ].join(' ').toLowerCase();
            return texto.includes(searchTerm);
        });
    }
    
    if (facturasAMostrar.length === 0) {
        invoiceList.innerHTML = '<div class="empty-state">' + 
            (searchTerm ? `No se encontraron facturas con "${searchTerm}"` : 'No hay facturas.<br>¡Añade tu primera factura!') +
            '</div>';
        checkWarrantyWarnings();
        return;
    }
    
    invoiceList.innerHTML = facturasAMostrar.map(function(invoice) {
        const comercio = invoice.comercio || '';
        const articulos = invoice.articulos || [];
        
        let displayText = comercio;
        let articulosHTML = '';
        
        if (articulos.length === 1) {
            displayText = comercio + ' - ' + articulos[0];
        } else if (articulos.length > 1) {
            articulosHTML = `<div class="productos-toggle" onclick="toggleProductos(${invoice.id})">📦 ${articulos.length} productos ▼</div>` +
                `<div class="productos-expandido" id="productos-${invoice.id}" style="display: none;">` +
                `<ul>${articulos.map(art => '<li>• ' + art + '</li>').join('')}</ul></div>`;
        }
        
        // Garantías
        let garantiaHTML = '';
        if (invoice.garantia) {
            const garantiaFecha = new Date(invoice.garantia);
            const dias = Math.floor((garantiaFecha - new Date()) / (1000 * 60 * 60 * 24));
            
            if (dias < 0) {
                garantiaHTML = '<div style="color: #999; font-size: 0.9em; margin-top: 5px;">❌ Garantía caducada</div>';
            } else if (dias < 90) {
                garantiaHTML = `<div style="color: #ff6b6b; font-size: 0.9em; margin-top: 5px;">⚠️ Garantía: ${formatearFecha(invoice.garantia)} (${dias} días)</div>`;
            } else {
                garantiaHTML = `<div style="color: #666; font-size: 0.9em; margin-top: 5px;">⏰ Garantía: ${formatearFecha(invoice.garantia)} 🇪🇸</div>`;
            }
        }
        
        if (invoice.garantiaExtendida && invoice.garantiaExtVence) {
            const dias = Math.floor((new Date(invoice.garantiaExtVence) - new Date()) / (1000 * 60 * 60 * 24));
            if (dias >= 0) {
                garantiaHTML += `<div style="color: #4facfe; font-size: 0.9em; margin-top: 3px;">🛡️ ${invoice.garantiaExtendida}: ${formatearFecha(invoice.garantiaExtVence)}</div>`;
            }
        }
        
        // Imagen
        let imagenHTML = '';
        if (invoice.photo) {
            imagenHTML = `<img src="${invoice.photo}" alt="Factura" class="invoice-image-preview" onclick="toggleImage(${invoice.id})" id="img-preview-${invoice.id}">` +
                `<img src="${invoice.photo}" alt="Factura" class="invoice-image-full" onclick="toggleImage(${invoice.id})" id="img-full-${invoice.id}" style="display: none;">`;
        }
        
        return `<div class="invoice-item">
            <div class="invoice-header">
                <div>
                    <div class="invoice-amount">${invoice.importe.toFixed(2)}€</div>
                    <div class="invoice-details">${getCategoryEmoji(invoice.categoria)} ${invoice.categoria || 'Sin categoría'} • ${invoice.fecha}</div>
                </div>
                <button class="btn-delete" onclick="deleteInvoice(${invoice.id})">🗑️</button>
            </div>
            <div><strong>${displayText}</strong></div>
            ${articulosHTML}
            ${garantiaHTML}
            ${imagenHTML}
        </div>`;
    }).join('');
    
    checkWarrantyWarnings();
}

// Toggle productos/imagen
function toggleProductos(id) {
    const div = document.getElementById('productos-' + id);
    if (div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
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

// Eliminar factura
function deleteInvoice(id) {
    if (confirm('¿Eliminar esta factura?')) {
        invoices = invoices.filter(inv => inv.id !== id);
        localStorage.setItem('invoices', JSON.stringify(invoices));
        renderInvoices();
    }
}

// Funciones del menú
function showAbout() {
    closeMenu();
    alert(`📱 DocuScan Pro v2.0

Gestión de facturas con IA

✨ Funciones:
• OCR automático con Gemini AI
• Detección de productos múltiples
• Garantías según ley española
• Avisos de vencimiento
• Exportar/Importar datos

👨‍💻 David - GPInformático
© 2025`);
}

function showLegal() {
    closeMenu();
    alert(`⚖️ AVISO LEGAL

PRIVACIDAD:
• Datos almacenados localmente
• Procesamiento con Gemini AI
• No se envía info a servidores propios

GARANTÍAS:
Info orientativa. Consulta legislación vigente.

España: 3 años para electrónica/electrodomésticos

gpinformatico.com`);
}

function exportData() {
    closeMenu();
    if (invoices.length === 0) {
        alert('❌ No hay facturas');
        return;
    }
    
    const blob = new Blob([JSON.stringify(invoices, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'facturas_' + new Date().toISOString().split('T')[0] + '.json';
    link.click();
    URL.revokeObjectURL(url);
    alert('✅ Datos exportados');
}

function importData() {
    closeMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    if (Array.isArray(data)) {
                        if (confirm('¿Añadir facturas (OK) o Reemplazar todas (Cancelar)?')) {
                            invoices = invoices.concat(data);
                        } else {
                            invoices = data;
                        }
                        localStorage.setItem('invoices', JSON.stringify(invoices));
                        renderInvoices();
                        alert('✅ Importadas: ' + data.length + ' facturas');
                    } else {
                        alert('❌ Formato inválido');
                    }
                } catch (error) {
                    alert('❌ Error al importar');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function deleteAllData() {
    closeMenu();
    if (confirm(`⚠️ ¿ELIMINAR ${invoices.length} facturas?\n\nNo se puede deshacer.`)) {
        if (confirm('¿Completamente seguro?')) {
            localStorage.removeItem('invoices');
            invoices = [];
            renderInvoices();
            alert('✅ Todo eliminado');
        }
    }
}

// Avisos de garantías
function checkWarrantyWarnings() {
    const warningsSection = document.getElementById('warnings-section');
    const warningsList = document.getElementById('warnings-list');
    const warningBadge = document.getElementById('warning-badge');
    const warningCount = document.getElementById('warning-count');
    
    if (!warningsSection) return;
    
    const hoy = new Date();
    const warnings = [];
    
    invoices.forEach(function(invoice) {
        if (invoice.garantia) {
            const dias = Math.floor((new Date(invoice.garantia) - hoy) / (1000 * 60 * 60 * 24));
            if (dias >= 0 && dias <= 90) {
                warnings.push({
                    tipo: 'legal',
                    comercio: invoice.comercio,
                    articulos: invoice.articulos,
                    dias: dias,
                    fecha: invoice.garantia,
                    urgente: dias <= 30
                });
            }
        }
        
        if (invoice.garantiaExtendida && invoice.garantiaExtVence) {
            const dias = Math.floor((new Date(invoice.garantiaExtVence) - hoy) / (1000 * 60 * 60 * 24));
            if (dias >= 0 && dias <= 90) {
                warnings.push({
                    tipo: 'extendida',
                    nombre: invoice.garantiaExtendida,
                    comercio: invoice.comercio,
                    articulos: invoice.articulos,
                    dias: dias,
                    fecha: invoice.garantiaExtVence
                });
            }
        }
    });
    
    if (warnings.length > 0) {
        warningsSection.style.display = 'block';
        warningBadge.style.display = 'block';
        warningCount.textContent = warnings.length;
        
        warnings.sort((a, b) => a.dias - b.dias);
        
        warningsList.innerHTML = warnings.map(function(w) {
            const articulo = (w.articulos && w.articulos[0]) || w.comercio;
            const urgencyClass = w.dias <= 30 ? 'urgent' : 'moderate';
            const icon = w.dias <= 30 ? '🔴' : '🟡';
            const urgencyText = w.dias <= 7 ? '¡MUY URGENTE!' : w.dias <= 30 ? 'URGENTE' : 'Próximamente';
            const tipo = w.tipo === 'legal' ? 'Garantía Legal 🇪🇸' : w.nombre;
            
            return `<div class="warning-item ${urgencyClass}">
                <div class="warning-item-info">
                    <div class="warning-item-title">${icon} ${urgencyText} - ${articulo}</div>
                    <div class="warning-item-details">${tipo} • Vence: ${formatearFecha(w.fecha)}</div>
                </div>
                <div class="warning-item-days">${w.dias}<br><small style="font-size: 12px;">días</small></div>
            </div>`;
        }).join('');
    } else {
        warningsSection.style.display = 'none';
        warningBadge.style.display = 'none';
    }
}

// Utilidades
function getCategoryEmoji(category) {
    const emojis = {
        'alimentacion': '🍔', 'tecnologia': '📱', 'electrodomesticos': '⚡',
        'ropa': '👕', 'hogar': '🏠', 'transporte': '🚗', 'suministros': '💡',
        'salud': '🏥', 'ocio': '🎮', 'deportes': '🏋️', 'educacion': '📚',
        'mascotas': '🐾', 'belleza': '💈', 'servicios': '🔧', 'otros': '📦'
    };
    return emojis[category] || '📄';
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${fecha.getFullYear()}`;
}

// Inicializar
renderInvoices();
checkWarrantyWarnings();
