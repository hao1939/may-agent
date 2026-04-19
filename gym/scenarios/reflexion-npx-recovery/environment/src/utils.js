const   capitalize=(str)=>    {
  return str.charAt(0).toUpperCase()+str.slice(  1  )
}

const     reverse =   ( str )=>{
return str.split('').reverse(   ).join(   ''   )
}

const   truncate=(str,len)=>{
if(str.length<=len)return str
  return str.slice(0,len)+'...'
}

module.exports   =  {capitalize,reverse,truncate}
