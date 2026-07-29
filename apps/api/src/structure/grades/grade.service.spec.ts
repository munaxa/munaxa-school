import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Grade } from '@prisma/client';
import { GradeService } from './grade.service';
import type { GradeRepository } from './grade.repository';

const GRADE = { id: 'g1', campusId: 'c1' } as Grade;

/** Build a service with stubbed repo functions exposed for assertions. */
function setup(opts: { campusExists?: boolean; found?: Grade | null } = {}) {
  const campusExists = jest
    .fn<Promise<boolean>, [string]>()
    .mockResolvedValue(opts.campusExists ?? true);
  const findById = jest
    .fn<Promise<Grade | null>, [string]>()
    .mockResolvedValue(opts.found === undefined ? GRADE : opts.found);
  const update = jest
    .fn<Promise<Grade>, [string, Partial<Grade>]>()
    .mockImplementation((_id, dto) => Promise.resolve({ ...GRADE, ...dto }));
  const repo = { campusExists, findById, update } as unknown as GradeRepository;
  return { service: new GradeService(repo), campusExists, findById, update };
}

describe('GradeService — foreign-key validation on update (data integrity)', () => {
  it('rejects a PATCH that reassigns the grade to a non-existent campus', async () => {
    const { service, update } = setup({ campusExists: false });
    await expect(service.update('g1', { campusId: 'missing' })).rejects.toThrow(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('allows a PATCH to a valid campus', async () => {
    const { service, campusExists } = setup({ campusExists: true });
    await expect(service.update('g1', { campusId: 'c2' })).resolves.toMatchObject({
      campusId: 'c2',
    });
    expect(campusExists).toHaveBeenCalledWith('c2');
  });

  it('does not require a campus check when campusId is not being changed', async () => {
    const { service, campusExists } = setup();
    await service.update('g1', {});
    expect(campusExists).not.toHaveBeenCalled();
  });

  it('404s on an unknown grade before validating the FK', async () => {
    const { service } = setup({ found: null });
    await expect(service.update('nope', { campusId: 'c2' })).rejects.toThrow(NotFoundException);
  });
});
