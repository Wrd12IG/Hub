"use client"

import * as React from "react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subYears } from "date-fns"
import { it } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function MetricoolDatePicker({
  className,
  date,
  setDate,
}: {
  className?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal bg-white border-input hover:bg-gray-50",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd MMM yyyy", { locale: it })} -{" "}
                  {format(date.to, "dd MMM yyyy", { locale: it })}
                </>
              ) : (
                format(date.from, "dd MMM yyyy", { locale: it })
              )
            ) : (
              <span>Seleziona periodo</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-col gap-1 p-3 border-r min-w-[150px]">
              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">Predefiniti</div>
              <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => setDate({ from: subDays(new Date(), 7), to: new Date() })}>Ultimi 7 giorni</Button>
              <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => setDate({ from: startOfMonth(new Date()), to: new Date() })}>Questo mese</Button>
              <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => setDate({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) })}>Mese scorso</Button>
              <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => setDate({ from: startOfQuarter(new Date()), to: new Date() })}>Questo trimestre</Button>
              <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => setDate({ from: startOfYear(new Date()), to: new Date() })}>Quest&apos;anno</Button>
              <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => setDate({ from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) })}>Anno scorso</Button>
            </div>
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
                locale={it}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
