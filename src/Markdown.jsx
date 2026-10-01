import React from 'react';
// Deliberately render Markdown as safe React text nodes. Raw HTML is never interpreted.
export default function Markdown({source=''}){
  const lines=String(source).split('\n');const out=[];let code=[],lang='',list=[];
  const flushCode=()=>{if(code.length){out.push(<div className="code-wrap" key={`c${out.length}`}><div className="code-head"><span>{lang||'code'}</span><button type="button" onClick={()=>navigator.clipboard.writeText(code.join('\n'))}>Copy</button></div><pre><code>{code.join('\n')}</code></pre></div>);code=[]}};
  const flushList=()=>{if(list.length){out.push(<ul key={`l${out.length}`}>{list.map((s,i)=><li key={i}>{inline(s)}</li>)}</ul>);list=[]}};
  let inCode=false;
  lines.forEach((line,i)=>{if(line.startsWith('```')){flushList();if(inCode){flushCode();inCode=false;lang=''}else{inCode=true;lang=line.slice(3).trim()}return}if(inCode){code.push(line);return}if(/^[-*] /.test(line)){list.push(line.slice(2));return}flushList();if(!line.trim())return;const h=line.match(/^(#{1,4})\s+(.+)/);if(h){const Tag=`h${Math.min(h[1].length+1,5)}`;out.push(<Tag key={i}>{inline(h[2])}</Tag>)}else if(line.startsWith('> '))out.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);else out.push(<p key={i}>{inline(line)}</p>)});flushList();flushCode();return <div className="prose">{out}</div>
}
function inline(s){return s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((p,i)=>p.startsWith('`')&&p.endsWith('`')?<code key={i}>{p.slice(1,-1)}</code>:p.startsWith('**')&&p.endsWith('**')?<strong key={i}>{p.slice(2,-2)}</strong>:p)}
