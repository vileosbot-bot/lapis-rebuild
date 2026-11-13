import {escapeHtml} from './ui-utils.ts';
import {
  ATTRIBUTE_KEYS,
  pendingAttributePoints,
  totalAttributeValue,
} from '../progression/attribute-points.ts';
import type {AttributeAllocationDraft,AttributeAllocationState,AttributeKey} from '../progression/attribute-points.ts';

export function renderAttributeAllocationPanel(
  state:AttributeAllocationState,
  draft:AttributeAllocationDraft,
):string{
  const pending=pendingAttributePoints(draft);
  const balance=Math.max(0,state.unspentPoints-pending);
  const rows=ATTRIBUTE_KEYS.map((key:AttributeKey)=>{
    const automatic=state.automaticGrowth[key];
    const allocated=state.allocated[key];
    const proposed=draft.pending[key];
    const total=totalAttributeValue(state,key)+proposed;
    return \`<div class="attribute-allocation-row" data-attribute-row="\${key}" style="display:grid;grid-template-columns:minmax(0,1fr) auto 44px;gap:8px;align-items:center;padding:6px;border-bottom:1px solid #596052">
      <div class="attribute-allocation-copy">
        <b>\${escapeHtml(key.toUpperCase())}</b>
        <small>自动成长 \${automatic} · 已分配 \${allocated} · 待确认 \${proposed}</small>
      </div>
      <output data-attribute-total="\${key}">\${total}</output>
      <button type="button" data-action="attribute-add" data-attribute="\${key}" aria-label="为 \${key.toUpperCase()} 分配一点" \${balance<=0?'disabled':''}>+</button>
    </div>\`;
  }).join('');
  return \`<section class="npc-dialogue m7-attribute-dialogue" data-ui="attribute-allocation-panel" aria-label="角色属性分配">
    <div class="npc-dialogue-portrait" aria-hidden="true"><b>属性</b><span>STATUS</span><small>M7.2</small></div>
    <div class="npc-dialogue-body">
      <div class="npc-dialogue-speaker">角色属性 / ATTRIBUTE ALLOCATION</div>
      <div class="npc-dialogue-copy">
        <p>当前等级 Lv.\${state.level} · 未分配属性点 <b data-unspent-points="\${balance}">\${balance}</b></p>
        <p>自动成长与手动分配分别记录；取消不会写入角色状态。</p>
      </div>
      <div class="attribute-allocation-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px">\${rows}</div>
      <div class="npc-dialogue-actions">
        <button type="button" data-action="attribute-cancel">取消</button>
        <button type="button" data-action="attribute-confirm" class="accent" \${pending<=0?'disabled':''}>确认分配（\${pending}）</button>
      </div>
      <small class="npc-dialogue-provenance">RECONSTRUCTION_POLICY / M7.2 / 不开放洗点</small>
    </div>
  </section>\`;
}
