const getPlayerAtZone=(players,zone)=>players.find((player)=>player.zone===zone);

const getPositionLabel=(player)=>{
  const labels={
    C:'Colocador',
    COL:'Colocador',
    OP:'Opuesto',
    O:'Opuesto',
    P1:'Punta 1',
    P2:'Punta 2',
    R1:'Receptor 1',
    R2:'Receptor 2',
    C1:'Central 1',
    C2:'Central 2',
    L:'Líbero'
  };

  return labels[player?.role]||player?.role||'posición desconocida';
};

const positionChecks=[
  {
    zones:[4,5],
    test:(front,back,tolerance)=>front.y<back.y-tolerance
  },
  {
    zones:[3,6],
    test:(front,back,tolerance)=>front.y<back.y-tolerance
  },
  {
    zones:[2,1],
    test:(front,back,tolerance)=>front.y<back.y-tolerance
  }
];

const createGuidance=(playerId,x,y,direction)=>({
  playerId,
  x,
  y,
  direction
});

const createDepthFaultMessage=(frontZone,backZone,frontPlayer,backPlayer)=>(
  `El jugador de zona ${frontZone} (${getPositionLabel(frontPlayer)}) debe estar más cerca de la red que el de zona ${backZone} (${getPositionLabel(backPlayer)}).`
);

const validateRows=(players,tolerance)=>{
  const faults=[];
  const guidance=[];

  positionChecks.forEach(({zones,test})=>{
    const front=getPlayerAtZone(players,zones[0]);
    const back=getPlayerAtZone(players,zones[1]);

    if(!front||!back){
      if(!front){
        faults.push(`Falta el jugador de zona ${zones[0]}.`);
      }

      if(!back){
        faults.push(`Falta el jugador de zona ${zones[1]}.`);
      }

      return;
    }

    if(!test(front,back,tolerance)){
      faults.push(createDepthFaultMessage(
        zones[0],
        zones[1],
        front,
        back
      ));
      guidance.push(createGuidance(front.id,front.x,front.y,'up'));
      guidance.push(createGuidance(back.id,back.x,back.y,'down'));
    }
  });

  const rows=[
    {
      players:[
        getPlayerAtZone(players,4),
        getPlayerAtZone(players,3),
        getPlayerAtZone(players,2)
      ],
      label:'delantera'
    },
    {
      players:[
        getPlayerAtZone(players,5),
        getPlayerAtZone(players,6),
        getPlayerAtZone(players,1)
      ],
      label:'fondo'
    }
  ];

  rows.forEach(({players:rowPlayers,label})=>{
    const [left,center,right]=rowPlayers;

    if(
      !left||
      !center||
      !right||
      !(left.x+tolerance<center.x&&center.x<right.x-tolerance)
    ){
      faults.push(
        `En la línea de ${label},la zona central (${getPositionLabel(center)}) debe estar entre las zonas laterales (${getPositionLabel(left)} y ${getPositionLabel(right)}).`
      );

      if(left&&center&&left.x>=center.x){
        guidance.push(createGuidance(left.id,left.x,left.y,'left'));
        guidance.push(createGuidance(center.id,center.x,center.y,'right'));
      }

      if(center&&right&&center.x>=right.x){
        guidance.push(createGuidance(center.id,center.x,center.y,'left'));
        guidance.push(createGuidance(right.id,right.x,right.y,'right'));
      }
    }
  });

  return {faults,guidance};
};

const validateLiberoZone=(players)=>{
  const libero=players.find((player)=>(
    player.role==='L'&&[2,3,4].includes(player.zone)
  ));

  if(!libero){
    return {fault:null,guidance:null};
  }

  return{
    fault:'El líbero no puede ocupar una zona delantera.',
    guidance:createGuidance(libero.id,libero.x,libero.y,'down')
  };
};

export const validateFormation=({players,teamState,tolerance=0.5})=>{
  const rowValidation=validateRows(players,tolerance);
  const liberoValidation=validateLiberoZone(players);
  const positionFaults=[...rowValidation.faults];
  const guidance=[...rowValidation.guidance];

  if(liberoValidation.fault){
    positionFaults.push(liberoValidation.fault);
    guidance.push(liberoValidation.guidance);
  }

  return{
    valid:positionFaults.length===0,
    rotationFault:false,
    positionFaults,
    faultPlayerIds:[...new Set(guidance.map((item)=>item.playerId))],
    guidance,
    expectedServer:getPlayerAtZone(players,1),
    teamState
  };
};