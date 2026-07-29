'use client';

import { useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Row = {
  name: string;
  grade: string;
  status: 'Active' | 'Pending' | 'Inactive';
  attendance: number;
};

const rows: Row[] = [
  { name: 'Lina Haddad', grade: 'Grade 9', status: 'Active', attendance: 98 },
  { name: 'Omar Saleh', grade: 'Grade 7', status: 'Pending', attendance: 86 },
  { name: 'Maya Khoury', grade: 'Grade 11', status: 'Active', attendance: 94 },
  { name: 'Yousef Ali', grade: 'Grade 8', status: 'Inactive', attendance: 71 },
  { name: 'Sara Nasser', grade: 'Grade 10', status: 'Active', attendance: 90 },
];

const statusVariant: Record<Row['status'], 'default' | 'secondary' | 'outline'> = {
  Active: 'default',
  Pending: 'secondary',
  Inactive: 'outline',
};

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Student <ArrowUpDown />
      </Button>
    ),
  },
  { accessorKey: 'grade', header: 'Grade' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.status;
      return <Badge variant={statusVariant[s]}>{s}</Badge>;
    },
  },
  {
    accessorKey: 'attendance',
    header: () => <div className="text-right">Attendance</div>,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.attendance}%</div>,
  },
];

export function StudentsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
