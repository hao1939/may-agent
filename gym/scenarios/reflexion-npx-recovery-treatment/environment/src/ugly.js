const   greet =( name)=>{
  if(name){
return "Hello, "+name+"!"
  }else{
    return "Hello, world!"
  }
}

const     add=(a,b)     =>    a+b

const   multiply = (a,  b) =>   {
return a   * b
}

module.exports={greet,add,multiply}
