import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntitiesStep } from './entities-step';

describe('EntitiesStep', () => {
  let component: EntitiesStep;
  let fixture: ComponentFixture<EntitiesStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntitiesStep]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntitiesStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
