const fallback=[
{id:'p1',league:'NBA',player:'Primary Guard',matchup:'Denver vs Phoenix',market:'Points',selection:'Over 24.5 points',odds:'-115',confidence:79,edge:'+4.5%'},
{id:'p2',league:'NBA',player:'Starting Center',matchup:'Boston vs New York',market:'Rebounds',selection:'Over 9.5 rebounds',odds:'-110',confidence:77,edge:'+3.8%'},
{id:'p3',league:'NFL',player:'WR1',matchup:'Kansas City vs Buffalo',market:'Receiving',selection:'Over 69.5 yards',odds:'-105',confidence:75,edge:'+3.1%'},
{id:'p4',league:'MLB',player:'Leadoff Hitter',matchup:'Los Angeles vs San Diego',market:'Hits',selection:'1+ hit',odds:'-170',confidence:81,edge:'+4.9%'}];
export default async function handler(req,res){res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=600');return res.status(200).json({source:'fallback',props:fallback})}
