// Nó "Montar recusa" (parada do fluxo). Sem modelo: texto fixo com os motivos da validação.
const v = $input.first().json;
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const html = `
<div style="text-align:left;font-size:14px;line-height:1.45">
<div style="background:#475467;color:#fff;padding:12px 14px;border-radius:8px;font-weight:700;font-size:16px">NÃO É POSSÍVEL AVALIAR ESTE VOO</div>
<p>O sistema parou antes de consultar as normas e o modelo, porque:</p>
<ul>${v.motivos.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
<p>Nenhuma conclusão foi tirada sobre este voo. Corrija os dados e envie de novo.</p>
</div>`;
return [{ json: { veredito: 'NÃO É POSSÍVEL AVALIAR', motivos: v.motivos, html } }];
