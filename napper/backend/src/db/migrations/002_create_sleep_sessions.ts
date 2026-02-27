import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sleep_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('baby_id').notNullable().references('id').inTable('babies').onDelete('CASCADE');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').nullable();
    // Duration in minutes, computed on end
    table.integer('duration_minutes').nullable();
    // 'nap' | 'night'
    table.string('sleep_type').notNullable().defaultTo('nap');
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.index(['baby_id', 'start_time']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('sleep_sessions');
}
