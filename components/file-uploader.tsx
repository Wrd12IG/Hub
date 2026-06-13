"use client"

import * as React from "react"
import { Paperclip } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FileUploaderProps {
    onUpload: (file: File) => Promise<void>
    disabled?: boolean
}

export function FileUploader({ onUpload, disabled }: FileUploaderProps) {
    const [open, setOpen] = React.useState(false)
    const [file, setFile] = React.useState<File | null>(null)
    const [uploading, setUploading] = React.useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setUploading(true)
        try {
            await onUpload(file)
            setOpen(false)
            setFile(null)
        } catch (error) {
            console.error("Upload failed", error)
        } finally {
            setUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={disabled}>
                    <Paperclip className="h-5 w-5" />
                    <span className="sr-only">Allega file</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Carica file</DialogTitle>
                    <DialogDescription>
                        Seleziona un file da caricare.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="file" className="text-right">
                            File
                        </Label>
                        <Input
                            id="file"
                            type="file"
                            className="col-span-3"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleUpload} disabled={!file || uploading}>
                        {uploading ? "Caricamento..." : "Carica"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
