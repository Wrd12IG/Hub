import dynamic from 'next/dynamic'

// L'editor usa la tela (Konva) e `window`: niente rendering sul server
const StoryEditorContainer = dynamic(() => import('@/components/story-editor/StoryEditorContainer'), { ssr: false })

export default function StoryEditorPage({ params }: { params: { id: string } }) {
  return <StoryEditorContainer clientId={params.id} />
}
