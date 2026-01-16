'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface DatePickerDialogProps {
    value?: Date;
    onChange: (date: Date | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    minDate?: Date;
    maxDate?: Date;
    label?: string;
}

export function DatePickerDialog({
    value,
    onChange,
    placeholder = 'Seleziona data',
    disabled = false,
    className,
    minDate,
    maxDate,
    label = 'Seleziona Data',
}: DatePickerDialogProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                disabled={disabled}
                className={cn(
                    "w-full justify-start text-left font-normal rounded-full",
                    !value && "text-muted-foreground",
                    className
                )}
                onClick={() => setOpen(true)}
            >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(value, 'dd/MM/yyyy') : placeholder}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[350px] p-4">
                    <DialogHeader>
                        <DialogTitle>{label}</DialogTitle>
                    </DialogHeader>
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={(date) => {
                            onChange(date);
                            setOpen(false);
                        }}
                        locale={it}
                        disabled={(date) => {
                            if (minDate && date < minDate) return true;
                            if (maxDate && date > maxDate) return true;
                            return false;
                        }}
                        className="rounded-md border"
                        initialFocus
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

export default DatePickerDialog;
