function Blobs() {
  return (
    <>
      {/* top left blob */}
      <div className="blob1" style={{
        position: 'absolute',
        top: '-20%',
        left: '-15%',
        width: 'clamp(400px, min(90vw, 90vh), 1000px)',
        height: 'clamp(400px, min(90vw, 90vh), 1000px)',
        background: '#F5C8C0',
        borderRadius: '60% 40% 70% 30% / 50% 60% 40% 50%',
        opacity: 0.5
      }} />

      {/* bottom right blob */}
      <div className="blob2" style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-15%',
        width: 'clamp(400px, min(95vw, 95vh), 1050px)',
        height: 'clamp(400px, min(95vw, 95vh), 1050px)',
        background: '#F5C8C0',
        borderRadius: '40% 60% 30% 70% / 60% 40% 50% 50%',
        opacity: 0.5
      }} />

      {/* top right blob */}
      <div className="blob3" style={{
        position: 'absolute',
        top: '-15%',
        right: '-10%',
        width: 'clamp(300px, min(70vw, 70vh), 750px)',
        height: 'clamp(300px, min(70vw, 70vh), 750px)',
        background: '#F5C842',
        borderRadius: '50% 30% 60% 40% / 40% 60% 30% 50%',
        opacity: 0.2
      }} />

      {/* bottom left blob */}
      <div className="blob4" style={{
        position: 'absolute',
        bottom: '-15%',
        left: '-10%',
        width: 'clamp(300px, min(75vw, 75vh), 800px)',
        height: 'clamp(300px, min(75vw, 75vh), 800px)',
        background: '#F5C842',
        borderRadius: '30% 60% 40% 70% / 50% 40% 60% 30%',
        opacity: 0.2
      }} />
    </>
  )
}

export default Blobs