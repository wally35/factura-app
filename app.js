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

// Función para procesar foto con OCR
async function procesarFoto(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            currentPhoto = e.target.result;
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
            
            alert('📸 Procesando imagen... Esto puede tardar unos segundos');
            
            try {
                const result = await Tesseract.recognize(
                    currentPhoto,
                    'spa',
                    { logger: function(m) { console.log(m); } }
                );
                
                const text = result.data.text;
                console.log('Texto detectado:', text);
                
                // EXTRAER DATOS INTELIGENTEMENTE
                let datosDetectados = [];
                
                // 1. Buscar TOTAL
                const totalMatch = text.match(/total[:\s]*(\d+[.,]\d{2})\s*€?/i);
                if (totalMatch) {
                    const amount = totalMatch[1].replace(',', '.');
                    document.getElementById('importe').value = amount;
                    datosDetectados.push('Total: ' + amount + '€');
                }
                
                // 2. Buscar FECHA (varios formatos)
                const fechaMatch = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                if (fechaMatch) {
                    const dia = fechaMatch[1].padStart(2, '0');
                    const mes = fechaMatch[2].padStart(2, '0');
                    let año = fechaMatch[3];
                    if (año.length === 2) año = '20' + año;
                    
                    // Si está en modo manual, rellenar directamente
                    if (modoManual) {
                        fechaManual.value = dia + '/' + mes + '/' + año;
                    } else {
                        // Si está en modo calendario, convertir
                        fechaCalendario.value = año + '-' + mes + '-' + dia;
                    }
                    datosDetectados.push('Fecha: ' + dia + '/' + mes + '/' + año);
                }
                
                // 3. Buscar NOMBRE DEL COMERCIO (primeras líneas)
                const lineas = text.split('\n').filter(function(l) { return l.trim().length > 0; });
                let comercio = '';
                for (let i = 0; i < Math.min(5, lineas.length); i++) {
                    const linea = lineas[i].trim();
                    // Ignorar si es solo números o muy corto
                    if (linea.length > 3 && linea.length < 60 && /[a-zA-Z]/.test(linea)) {
                        comercio = linea;
                        break;
                    }
                }
                if (comercio && !document.getElementById('concepto').value) {
                    document.getElementById('concepto').value = comercio;
                    datosDetectados.push('Comercio detectado');
                }
                
                // 4. MENSAJE FINAL
                if (datosDetectados.length > 0) {
                    alert('✅ Datos detectados:\n' + datosDetectados.join('\n') + '\n\n⚠️ Revisa que todo sea correcto antes de guardar.');
                } else {
                    alert('⚠️ No se pudieron detectar datos automáticamente. Introdúcelos manualmente.');
                }
                
            } catch (error) {
                console.error('Error en OCR:', error);
                alert('❌ Error al procesar la imagen. Introduce los datos manualmente.');
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
    toggleGarantiaPersonalizada(); // Ocultar campo personalizado
    
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
