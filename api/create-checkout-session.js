export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const secret=process.env.STRIPE_SECRET_KEY;
  if(!secret) return res.status(503).json({error:'Stripe server key is not configured'});
  const {priceId,email}=req.body||{};
  if(priceId!=='price_1U8Fw4F0N4LztQxo7Z8JZWY9') return res.status(400).json({error:'Invalid price'});
  const origin=`https://${req.headers.host}`;
  const form=new URLSearchParams();
  form.set('mode','subscription');
  form.set('line_items[0][price]',priceId);
  form.set('line_items[0][quantity]','1');
  form.set('success_url',`${origin}/?checkout=success`);
  form.set('cancel_url',`${origin}/?checkout=cancelled`);
  form.set('allow_promotion_codes','true');
  if(email) form.set('customer_email',email);
  const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',
    headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},
    body:form
  });
  const data=await r.json();
  if(!r.ok) return res.status(r.status).json({error:data.error?.message||'Stripe error'});
  return res.status(200).json({url:data.url});
}
