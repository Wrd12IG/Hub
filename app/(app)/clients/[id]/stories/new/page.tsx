import dynamic from 'next/dynamic'

// Disabilitiamo il Server Side Rendering per il componente CanvasEditor 
// altrimenti la libreria Konva (che usa 'window') andrà in crash in fase di build
const CanvasEditor = dynamic(() => import('./CanvasEditor'), {
  ssr: false,
})

export default function StoryEditorPage({ params }: { params: { id: string } }) {
  return <CanvasEditor clientId={params.id} />
}
